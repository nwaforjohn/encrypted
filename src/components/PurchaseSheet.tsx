import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';
import type { ProductDef } from '@/monetization/products';

/**
 * A simple bottom-sheet picker used for tips and post promotions. Shows each
 * tier with its price hint and calls onSelect(sku).
 */
export function PurchaseSheet({
  visible,
  title,
  subtitle,
  options,
  busySku,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: ProductDef[];
  busySku?: string | null;
  onSelect: (sku: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {options.map((opt) => {
            const busy = busySku === opt.sku;
            return (
              <Pressable
                key={opt.sku}
                style={[styles.option, busy && styles.optionBusy]}
                disabled={!!busySku}
                onPress={() => onSelect(opt.sku)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{opt.title}</Text>
                  <Text style={styles.optionDesc}>{opt.description}</Text>
                </View>
                <Text style={styles.price}>
                  {busy ? '…' : opt.priceHint ?? ''}
                </Text>
              </Pressable>
            );
          })}

          <Pressable style={styles.cancel} onPress={onClose} disabled={!!busySku}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing(2),
    paddingBottom: theme.spacing(4),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing(1.5),
  },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, marginTop: 4, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(1),
  },
  optionBusy: { opacity: 0.6 },
  optionTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 15 },
  optionDesc: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  price: { color: theme.colors.primary, fontWeight: '700', fontSize: 15, marginLeft: 8 },
  cancel: { alignItems: 'center', paddingVertical: theme.spacing(1.5), marginTop: theme.spacing(1) },
  cancelText: { color: theme.colors.textMuted, fontSize: 15 },
});
