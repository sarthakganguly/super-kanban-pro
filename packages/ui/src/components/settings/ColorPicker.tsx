/**
 * ColorPicker
 *
 * A grid of color swatches. Tapping one calls onChange with the hex string.
 * Used for lane color selection in Settings and the lane rename modal.
 *
 * Renders a checkmark on the selected color so it's accessible to
 * color-blind users (not just the fill color difference).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANE_COLOR_PALETTE } from '../../../services/src/settings/SettingsService';

export interface ColorPickerProps {
  value:    string;
  palette?: readonly string[];
  onChange: (color: string) => void;
}

export function ColorPicker({
  value,
  palette = LANE_COLOR_PALETTE,
  onChange,
}: ColorPickerProps) {
  return (
    <View style={styles.grid}>
      {palette.map((color) => {
        const isSelected = color === value;
        return (
          <Pressable
            key={color}
            onPress={() => onChange(color)}
            style={[
              styles.swatch,
              { backgroundColor: color },
              isSelected && styles.swatchSelected,
            ]}
            accessibilityRole="radio"
            accessibilityLabel={`Color ${color}`}
            accessibilityState={{ checked: isSelected }}
          >
            {isSelected && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch:         {
    width:        32,
    height:       32,
    borderRadius: 8,
    alignItems:   'center',
    justifyContent: 'center',
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation:    2,
  },
  swatchSelected: {
    shadowOpacity: 0.35,
    shadowRadius:  4,
    elevation:     4,
    transform:     [{ scale: 1.12 }],
  },
  checkmark:      { color: '#fff', fontSize: 14, fontWeight: '700' },
});
