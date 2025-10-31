import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type ConnectWalletButtonProps = {
  variant?: 'icon' | 'button';
};

const shorten = (s: string, head = 4, tail = 4) => {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
};

export const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({ variant = 'button' }) => {
  // Stubbed behavior for Expo Go: no native wallet adapters available.
  const [isOpen, setIsOpen] = useState(false);
  const connected = false;
  const display = useMemo(() => 'Connect Wallet', []);
  const handleOpen = () => setIsOpen(true);
  const handleSelect = async (_name: string) => setIsOpen(false);

  if (variant === 'icon') {
    return (
      <Pressable accessibilityRole="button" onPress={handleOpen} style={styles.iconButton}>
        <Text style={styles.iconText}>🪪</Text>
        <WalletPickerModal visible={isOpen} onClose={() => setIsOpen(false)} onSelect={handleSelect} wallets={["Dev build required"]} />
      </Pressable>
    );
  }

  return (
    <>
      <Pressable accessibilityRole="button" onPress={handleOpen} style={styles.button}>
        <Text style={styles.buttonText}>{display}</Text>
      </Pressable>
      <WalletPickerModal
        visible={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={handleSelect}
        wallets={["Dev build required"]}
      />
    </>
  );
};

const WalletPickerModal: React.FC<{
  visible: boolean;
  wallets: string[];
  onSelect: (name: string) => void;
  onClose: () => void;
}> = ({ visible, wallets, onSelect, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select a wallet</Text>
          <View style={styles.modalList}>
            {wallets.map((name) => (
              <Pressable key={name} accessibilityRole="button" style={styles.walletRow} onPress={() => onSelect(name)}>
                <Text style={styles.walletName}>{name}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconText: {
    fontSize: 16,
    color: '#ffffff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#0b0b0c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalList: {
    gap: 8,
  },
  walletRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  walletName: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: {
    color: '#a3a3a3',
    fontSize: 14,
  },
});

export default ConnectWalletButton;


