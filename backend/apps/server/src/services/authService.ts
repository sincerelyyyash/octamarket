import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/database';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { RegisterRequest, LoginRequest, UpdateProfileRequest, JwtPayload } from '../types/index.js';

export class AuthService {
  private readonly saltRounds = 12;

  async register(data: RegisterRequest): Promise<{ user: any; token: string }> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, this.saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
        },
      });

      // Generate JWT token
      const token = this.generateToken({
        userId: user.id,
        email: user.email!,
      });

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        token,
      };
    } catch (error) {
      logger.error('Registration failed', {
        email: data.email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<{ user: any; token: string }> {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      if (!user.password) {
        throw new Error('Invalid email or password');
      }
      
      const isValidPassword = await bcrypt.compare(data.password, user.password);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = this.generateToken({
        userId: user.id,
        email: user.email!,
      });

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        token,
      };
    } catch (error) {
      logger.error('Login failed', {
        email: data.email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<any> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          name: data.name,
          email: data.email,
        },
      });

      logger.info('Profile updated successfully', { userId });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    } catch (error) {
      logger.error('Profile update failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getUserById(userId: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    } catch (error) {
      logger.error('Get user failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  verifyToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      return payload;
    } catch (error) {
      logger.error('Token verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Invalid token');
    }
  }

  private generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  async connectWallet(userId: string, walletAddress: string): Promise<any> {
    try {
      // Validate wallet address format (basic Ethereum address validation)
      if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid wallet address format');
      }

      // Check if wallet is already connected to another user
      const existingWalletUser = await prisma.user.findUnique({
        where: { walletAddress },
      });

      if (existingWalletUser && existingWalletUser.id !== userId) {
        throw new Error('Wallet address is already connected to another account');
      }

      // Update user with wallet address
      const user = await prisma.user.update({
        where: { id: userId },
        data: { walletAddress },
      });

      logger.info('Wallet connected successfully', { userId, walletAddress });

      return {
        message: 'Wallet connected successfully',
        userId: user.id,
        walletAddress: user.walletAddress,
      };
    } catch (error) {
      logger.error('Wallet connection failed', {
        userId,
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const authService = new AuthService();
