use anchor_lang::prelude::*;

use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("DSzcxNHsezokjETdk9ymJYvR27bGS876g2EqoVxQraQE");

#[program]
pub mod octamarket {
    use super::*;

    // Protocol fee in basis points (1 bps = 0.01%). Example: 50 = 0.5%
    const PROTOCOL_FEE_BPS: u16 = 50;

    pub fn init_user(ctx: Context<InitUser>, kyc_hash: Option<[u8; 32]>) -> Result<()> {
        let user = &mut ctx.accounts.user;
        user.owner = ctx.accounts.owner.key();
        user.kyc_hash = kyc_hash;
        user.created_at = Clock::get()?.unix_timestamp;
        user.bump = ctx.bumps.user;
        
        msg!("User initialized: {}", user.owner);
        Ok(())
    }

    pub fn open_intent(
        ctx: Context<OpenIntent>,
        intent_id: [u8; 16],
        market_id: [u8; 32],
        side: TradeSide,
        quantity: u64,
        max_price: u64,
        expiry: i64,
    ) -> Result<()> {
        let intent = &mut ctx.accounts.intent;
        let clock = Clock::get()?;
        
        require!(expiry > clock.unix_timestamp, ErrorCode::InvalidExpiry);
        require!(quantity > 0, ErrorCode::InvalidQuantity);
        require!(max_price > 0 && max_price <= 1_000_000, ErrorCode::InvalidPrice); // max 1.0 scaled by 1e6
        
        // Transfer USDC to vault as escrow
        let escrow_amount = (quantity as u128)
            .checked_mul(max_price as u128)
            .and_then(|v| v.checked_div(1_000_000))
            .ok_or(ErrorCode::MathOverflow)? as u64;
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            escrow_amount,
        )?;
        
        intent.intent_id = intent_id;
        intent.user = ctx.accounts.user.key();
        intent.market_id = market_id;
        intent.side = side;
        intent.quantity = quantity;
        intent.max_price = max_price;
        intent.expiry = expiry;
        intent.escrow_amount = escrow_amount;
        intent.state = IntentState::Open;
        intent.created_at = clock.unix_timestamp;
        intent.bump = ctx.bumps.intent;
        
        emit!(IntentOpened {
            intent_id,
            user: ctx.accounts.user.key(),
            market_id,
            side,
            quantity,
            max_price,
            escrow_amount,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn cancel_intent(ctx: Context<CancelIntent>) -> Result<()> {
        let intent = &mut ctx.accounts.intent;
        
        require!(intent.state == IntentState::Open, ErrorCode::InvalidState);
        
        // Refund escrowed USDC (vault authority is the vault_bump PDA)
        let user_key = ctx.accounts.user.key();
        let seeds = &[
            b"vault_bump",
            user_key.as_ref(),
            &[ctx.accounts.vault_bump.bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.vault_bump.to_account_info(),
                },
                signer_seeds,
            ),
            intent.escrow_amount,
        )?;
        
        intent.state = IntentState::Cancelled;
        
        emit!(IntentCancelled {
            intent_id: intent.intent_id,
            user: intent.user,
            refund_amount: intent.escrow_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn settle_fill(
        ctx: Context<SettleFill>,
        venue: Venue,
        filled_quantity: u64,
        avg_price: u64,
        tx_ref: [u8; 64],
    ) -> Result<()> {
        let intent = &mut ctx.accounts.intent;
        let position = &mut ctx.accounts.position;
        let clock = Clock::get()?;
        
        require!(intent.state == IntentState::Open, ErrorCode::InvalidState);
        require!(filled_quantity > 0 && filled_quantity <= intent.quantity, ErrorCode::InvalidQuantity);
        
        // Calculate actual cost
        let actual_cost = (filled_quantity as u128)
            .checked_mul(avg_price as u128)
            .and_then(|v| v.checked_div(1_000_000))
            .ok_or(ErrorCode::MathOverflow)? as u64;
        
        require!(actual_cost <= intent.escrow_amount, ErrorCode::InsufficientEscrow);

        // Compute protocol fee on actual cost
        let fee = (actual_cost as u128)
            .checked_mul(PROTOCOL_FEE_BPS as u128)
            .and_then(|v| v.checked_div(10_000))
            .ok_or(ErrorCode::MathOverflow)? as u64;

        // Ensure escrow covers cost + fee
        require!(actual_cost.checked_add(fee).unwrap() <= intent.escrow_amount, ErrorCode::InsufficientEscrow);

        // Transfer protocol fee from vault to treasury (vault authority is the vault_bump PDA)
        if fee > 0 {
            let user_key = ctx.accounts.user.key();

            let vb_seeds = &[
                b"vault_bump",

                user_key.as_ref(),
                &[ctx.accounts.vault_bump.bump],
            ];
            let vb_signer = &[&vb_seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                        authority: ctx.accounts.vault_bump.to_account_info(),
                    },
                    vb_signer,
                ),
                fee,
            )?;
        }

        // Refund remaining escrow after deducting actual cost and fee
        let refund = intent
            .escrow_amount
            .checked_sub(actual_cost)
            .and_then(|v| v.checked_sub(fee))
            .ok_or(ErrorCode::MathOverflow)?;
        if refund > 0 {
            let user_key = ctx.accounts.user.key();

            let vb_seeds = &[
                b"vault_bump",

                user_key.as_ref(),
                &[ctx.accounts.vault_bump.bump],
            ];
            let vb_signer = &[&vb_seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.user_token_account.to_account_info(),
                        authority: ctx.accounts.vault_bump.to_account_info(),
                    },
                    vb_signer,
                ),
                refund,
            )?;
        }
        
        // Update position
        if position.market_id == [0u8; 32] {
            // Initialize position
            position.user = ctx.accounts.user.key();
            position.market_id = intent.market_id;
            position.bump = ctx.bumps.position;
        }
        
        match intent.side {
            TradeSide::Buy => {
                position.quantity = position.quantity.checked_add(filled_quantity as i64).unwrap();
                position.cost_basis = position.cost_basis.checked_add(actual_cost).unwrap();
            }
            TradeSide::Sell => {
                position.quantity = position.quantity.checked_sub(filled_quantity as i64).unwrap();
                // Realized PnL calculation would go here
            }
        }
        
        position.last_trade_at = clock.unix_timestamp;
        intent.state = IntentState::Filled;
        
        emit!(FillSettled {
            intent_id: intent.intent_id,
            user: intent.user,
            market_id: intent.market_id,
            venue,
            filled_quantity,
            avg_price,
            actual_cost,
            tx_ref,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn set_copy_policy(
        ctx: Context<SetCopyPolicy>,
        copy_percentage: u16,
        max_copy_amount: u64,
        max_daily_amount: u64,
        expiry: i64,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.copy_policy;
        let clock = Clock::get()?;
        
        require!(copy_percentage <= 10000, ErrorCode::InvalidPercentage); // max 100%
        require!(expiry > clock.unix_timestamp, ErrorCode::InvalidExpiry);
        
        policy.follower = ctx.accounts.owner.key();
        policy.copy_percentage = copy_percentage;
        policy.max_copy_amount = max_copy_amount;
        policy.max_daily_amount = max_daily_amount;
        policy.expiry = expiry;
        policy.enabled = true;
        policy.bump = ctx.bumps.copy_policy;
        
        emit!(CopyPolicySet {
            follower: policy.follower,
            copy_percentage,
            max_copy_amount,
            max_daily_amount,
            expiry,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn fund_escrow(ctx: Context<FundEscrow>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;
        
        Ok(())
    }

    pub fn withdraw_escrow(ctx: Context<WithdrawEscrow>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(ctx.accounts.vault.amount >= amount, ErrorCode::InsufficientEscrow);
        
        let user_key = ctx.accounts.user.key();

        
        let seeds = &[
            b"vault_bump",

        
            user_key.as_ref(),
            &[ctx.accounts.vault_bump.bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.vault_bump.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;
        
        Ok(())
    }

    pub fn open_copy_intent(
        ctx: Context<OpenCopyIntent>,
        leader_trade_ref: [u8; 32],
        market_id: [u8; 32],
        side: TradeSide,
        quantity: u64,
        price_cap: u64,
    ) -> Result<()> {
        let policy = &ctx.accounts.copy_policy;
        let copy_intent = &mut ctx.accounts.copy_intent;
        let clock = Clock::get()?;
        
        require!(policy.enabled, ErrorCode::PolicyDisabled);
        require!(policy.expiry > clock.unix_timestamp, ErrorCode::PolicyExpired);
        require!(quantity > 0, ErrorCode::InvalidQuantity);
        
        let escrow_amount = (quantity as u128)
            .checked_mul(price_cap as u128)
            .and_then(|v| v.checked_div(1_000_000))
            .ok_or(ErrorCode::MathOverflow)? as u64;
        
        require!(escrow_amount <= policy.max_copy_amount, ErrorCode::ExceedsMaxCopy);
        require!(ctx.accounts.vault.amount >= escrow_amount, ErrorCode::InsufficientEscrow);
        
        copy_intent.follower = policy.follower;
        copy_intent.leader_trade_ref = leader_trade_ref;
        copy_intent.market_id = market_id;
        copy_intent.side = side;
        copy_intent.quantity = quantity;
        copy_intent.price_cap = price_cap;
        copy_intent.escrow_amount = escrow_amount;
        copy_intent.state = IntentState::Open;
        copy_intent.created_at = clock.unix_timestamp;
        copy_intent.bump = ctx.bumps.copy_intent;
        
        emit!(CopyIntentOpened {
            follower: policy.follower,
            leader_trade_ref,
            market_id,
            side,
            quantity,
            price_cap,
            escrow_amount,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn settle_fill_copy(
        ctx: Context<SettleFillCopy>,
        venue: Venue,
        filled_quantity: u64,
        avg_price: u64,
        tx_ref: [u8; 64],
    ) -> Result<()> {
        let copy_intent = &mut ctx.accounts.copy_intent;
        let position = &mut ctx.accounts.position;
        let clock = Clock::get()?;
        
        require!(copy_intent.state == IntentState::Open, ErrorCode::InvalidState);
        require!(filled_quantity > 0 && filled_quantity <= copy_intent.quantity, ErrorCode::InvalidQuantity);
        
        let actual_cost = (filled_quantity as u128)
            .checked_mul(avg_price as u128)
            .and_then(|v| v.checked_div(1_000_000))
            .ok_or(ErrorCode::MathOverflow)? as u64;
        
        require!(actual_cost <= copy_intent.escrow_amount, ErrorCode::InsufficientEscrow);

        // Compute protocol fee and ensure coverage
        let fee = (actual_cost as u128)
            .checked_mul(PROTOCOL_FEE_BPS as u128)
            .and_then(|v| v.checked_div(10_000))
            .ok_or(ErrorCode::MathOverflow)? as u64;
        require!(actual_cost.checked_add(fee).unwrap() <= copy_intent.escrow_amount, ErrorCode::InsufficientEscrow);

        // Transfer protocol fee to treasury from vault
        if fee > 0 {
            let user_key = ctx.accounts.user.key();

            let vb_seeds = &[
                b"vault_bump",

                user_key.as_ref(),
                &[ctx.accounts.vault_bump.bump],
            ];
            let vb_signer = &[&vb_seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                        authority: ctx.accounts.vault_bump.to_account_info(),
                    },
                    vb_signer,
                ),
                fee,
            )?;
        }

        // Refund remaining escrow after deducting actual cost and fee
        let refund = copy_intent
            .escrow_amount
            .checked_sub(actual_cost)
            .and_then(|v| v.checked_sub(fee))
            .ok_or(ErrorCode::MathOverflow)?;
        if refund > 0 {
            let user_key = ctx.accounts.user.key();

            let vb_seeds = &[
                b"vault_bump",

                user_key.as_ref(),
                &[ctx.accounts.vault_bump.bump],
            ];
            let vb_signer = &[&vb_seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.user_token_account.to_account_info(),
                        authority: ctx.accounts.vault_bump.to_account_info(),
                    },
                    vb_signer,
                ),
                refund,
            )?;
        }
        
        // Update position
        if position.market_id == [0u8; 32] {
            position.user = ctx.accounts.user.key();
            position.market_id = copy_intent.market_id;
            position.bump = ctx.bumps.position;
        }
        
        match copy_intent.side {
            TradeSide::Buy => {
                position.quantity = position.quantity.checked_add(filled_quantity as i64).unwrap();
                position.cost_basis = position.cost_basis.checked_add(actual_cost).unwrap();
            }
            TradeSide::Sell => {
                position.quantity = position.quantity.checked_sub(filled_quantity as i64).unwrap();
            }
        }
        
        position.last_trade_at = clock.unix_timestamp;
        copy_intent.state = IntentState::Filled;
        
        emit!(CopyFillSettled {
            follower: copy_intent.follower,
            leader_trade_ref: copy_intent.leader_trade_ref,
            market_id: copy_intent.market_id,
            venue,
            filled_quantity,
            avg_price,
            actual_cost,
            tx_ref,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
}

// Account Structures
#[account]
pub struct User {
    pub owner: Pubkey,
    pub kyc_hash: Option<[u8; 32]>,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct Intent {
    pub intent_id: [u8; 16],
    pub user: Pubkey,
    pub market_id: [u8; 32],
    pub side: TradeSide,
    pub quantity: u64,
    pub max_price: u64,
    pub expiry: i64,
    pub escrow_amount: u64,
    pub state: IntentState,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct Position {
    pub user: Pubkey,
    pub market_id: [u8; 32],
    pub quantity: i64,
    pub cost_basis: u64,
    pub last_trade_at: i64,
    pub bump: u8,
}

#[account]
pub struct CopyPolicy {
    pub follower: Pubkey,
    pub copy_percentage: u16,
    pub max_copy_amount: u64,
    pub max_daily_amount: u64,
    pub expiry: i64,
    pub enabled: bool,
    pub bump: u8,
}

#[account]
pub struct CopyIntent {
    pub follower: Pubkey,
    pub leader_trade_ref: [u8; 32],
    pub market_id: [u8; 32],
    pub side: TradeSide,
    pub quantity: u64,
    pub price_cap: u64,
    pub escrow_amount: u64,
    pub state: IntentState,
    pub created_at: i64,
    pub bump: u8,
}

// Vault is an SPL Token Account, not a custom account
#[account]
#[derive(Default)]
pub struct VaultBump {
    pub bump: u8,
}

// Treasury bump PDA (global authority for treasury token accounts)
#[account]
#[derive(Default)]
pub struct TreasuryBump {
    pub bump: u8,
}

// Context Structures
#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 33 + 8 + 1,
        seeds = [b"user", owner.key().as_ref()],
        bump
    )]
    pub user: Account<'info, User>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(intent_id: [u8; 16])]
pub struct OpenIntent<'info> {
    #[account(
        seeds = [b"user", owner.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + 16 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 8 + 1,
        seeds = [b"intent", user.key().as_ref(), &intent_id],
        bump
    )]
    pub intent: Account<'info, Intent>,
    
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + 1,
        seeds = [b"vault_bump", user.key().as_ref()],
        bump
    )]
    pub vault_bump: Account<'info, VaultBump>,
    
    #[account(
        init_if_needed,
        payer = owner,
        token::mint = usdc_mint,
        token::authority = vault_bump,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == owner.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub usdc_mint: Account<'info, token::Mint>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CancelIntent<'info> {
    #[account(
        seeds = [b"user", owner.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,
    
    #[account(
        mut,
        seeds = [b"intent", user.key().as_ref(), &intent.intent_id],
        bump = intent.bump,
        constraint = intent.user == user.key()
    )]
    pub intent: Account<'info, Intent>,
    
    #[account(
        seeds = [b"vault_bump", user.key().as_ref()],
        bump = vault_bump.bump
    )]
    pub vault_bump: Account<'info, VaultBump>,
    
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == owner.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SettleFill<'info> {
    #[account(
        seeds = [b"user", intent.user.as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,
    
    #[account(
        mut,
        seeds = [b"intent", user.key().as_ref(), &intent.intent_id],
        bump = intent.bump
    )]
    pub intent: Account<'info, Intent>,
    
    #[account(
        init_if_needed,
        payer = relayer,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1,
        seeds = [b"position", user.key().as_ref(), &intent.market_id],
        bump
    )]
    pub position: Account<'info, Position>,
    
    #[account(
        seeds = [b"vault_bump", user.key().as_ref()],
        bump = vault_bump.bump
    )]
    pub vault_bump: Account<'info, VaultBump>,
    
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    // Treasury accounts (created on-demand by relayer)
    #[account(
        init_if_needed,
        payer = relayer,
        space = 8 + 1,
        seeds = [b"treasury_bump"],
        bump
    )]
    pub treasury_bump: Account<'info, TreasuryBump>,
    #[account(
        init_if_needed,
        payer = relayer,
        token::mint = usdc_mint,
        token::authority = treasury_bump,
        seeds = [b"treasury", usdc_mint.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, token::Mint>,
    
    #[account(mut)]
    pub relayer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCopyPolicy<'info> {
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + 32 + 2 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"copy_policy", owner.key().as_ref()],
        bump
    )]
    pub copy_policy: Account<'info, CopyPolicy>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(
        seeds = [b"user", owner.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,
    
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + 1,
        seeds = [b"vault_bump", user.key().as_ref()],
        bump
    )]
    pub vault_bump: Account<'info, VaultBump>,
    
    #[account(
        init_if_needed,
        payer = owner,
        token::mint = usdc_mint,
        token::authority = vault_bump,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == owner.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub usdc_mint: Account<'info, token::Mint>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawEscrow<'info> {
    #[account(
        seeds = [b"user", owner.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,
    
    #[account(
        seeds = [b"vault_bump", user.key().as_ref()],
        bump = vault_bump.bump
    )]
    pub vault_bump: Account<'info, VaultBump>,
    
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == owner.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(leader_trade_ref: [u8; 32])]
pub struct OpenCopyIntent<'info> {
    #[account(
        seeds = [b"user", copy_policy.follower.as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,
    
    #[account(
        seeds = [b"copy_policy", copy_policy.follower.as_ref()],
        bump = copy_policy.bump
    )]
    pub copy_policy: Account<'info, CopyPolicy>,
    
    #[account(
        init,
        payer = relayer,
        space = 8 + 32 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 8 + 1,
        seeds = [b"copy_intent", copy_policy.follower.as_ref(), &leader_trade_ref],
        bump
    )]
    pub copy_intent: Account<'info, CopyIntent>,
    
    #[account(
        seeds = [b"vault_bump", user.key().as_ref()],
        bump = vault_bump.bump
    )]
    pub vault_bump: Account<'info, VaultBump>,
    
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub relayer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleFillCopy<'info> {
    #[account(
        seeds = [b"user", copy_intent.follower.as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, User>,
    
    #[account(
        mut,
        seeds = [b"copy_intent", copy_intent.follower.as_ref(), &copy_intent.leader_trade_ref],
        bump = copy_intent.bump
    )]
    pub copy_intent: Account<'info, CopyIntent>,
    
    #[account(
        init_if_needed,
        payer = relayer,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1,
        seeds = [b"position", user.key().as_ref(), &copy_intent.market_id],
        bump
    )]
    pub position: Account<'info, Position>,
    
    #[account(
        seeds = [b"vault_bump", user.key().as_ref()],
        bump = vault_bump.bump
    )]
    pub vault_bump: Account<'info, VaultBump>,
    
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    // Treasury accounts (created on-demand by relayer)
    #[account(
        init_if_needed,
        payer = relayer,
        space = 8 + 1,
        seeds = [b"treasury_bump"],
        bump
    )]
    pub treasury_bump: Account<'info, TreasuryBump>,
    #[account(
        init_if_needed,
        payer = relayer,
        token::mint = usdc_mint,
        token::authority = treasury_bump,
        seeds = [b"treasury", usdc_mint.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, token::Mint>,
    
    #[account(mut)]
    pub relayer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TradeSide {
    Buy,
    Sell,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum IntentState {
    Open,
    Filled,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum Venue {
    Kalshi,
    Polymarket,
}

// Events
#[event]
pub struct IntentOpened {
    pub intent_id: [u8; 16],
    pub user: Pubkey,
    pub market_id: [u8; 32],
    pub side: TradeSide,
    pub quantity: u64,
    pub max_price: u64,
    pub escrow_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct IntentCancelled {
    pub intent_id: [u8; 16],
    pub user: Pubkey,
    pub refund_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct FillSettled {
    pub intent_id: [u8; 16],
    pub user: Pubkey,
    pub market_id: [u8; 32],
    pub venue: Venue,
    pub filled_quantity: u64,
    pub avg_price: u64,
    pub actual_cost: u64,
    pub tx_ref: [u8; 64],
    pub timestamp: i64,
}

#[event]
pub struct CopyPolicySet {
    pub follower: Pubkey,
    pub copy_percentage: u16,
    pub max_copy_amount: u64,
    pub max_daily_amount: u64,
    pub expiry: i64,
    pub timestamp: i64,
}

#[event]
pub struct CopyIntentOpened {
    pub follower: Pubkey,
    pub leader_trade_ref: [u8; 32],
    pub market_id: [u8; 32],
    pub side: TradeSide,
    pub quantity: u64,
    pub price_cap: u64,
    pub escrow_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct CopyFillSettled {
    pub follower: Pubkey,
    pub leader_trade_ref: [u8; 32],
    pub market_id: [u8; 32],
    pub venue: Venue,
    pub filled_quantity: u64,
    pub avg_price: u64,
    pub actual_cost: u64,
    pub tx_ref: [u8; 64],
    pub timestamp: i64,
}

// Error Codes
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid expiry time")]
    InvalidExpiry,
    #[msg("Invalid quantity")]
    InvalidQuantity,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid percentage")]
    InvalidPercentage,
    #[msg("Invalid state for this operation")]
    InvalidState,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Insufficient escrow")]
    InsufficientEscrow,
    #[msg("Policy is disabled")]
    PolicyDisabled,
    #[msg("Policy has expired")]
    PolicyExpired,
    #[msg("Exceeds maximum copy amount")]
    ExceedsMaxCopy,
}
