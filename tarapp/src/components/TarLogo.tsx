import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

const LOGO_ROWS = [
  { cells: [1, 1, 0, 0, 0, 1, 1], heightRatio: 1.0 },  // Row 0: Ear tips (cols 0,1 & 5,6)
  { cells: [0, 1, 1, 1, 1, 1, 0], heightRatio: 1.0 },  // Row 1: Outer ear notches on sides, solid head top
  { cells: [1, 1, 1, 1, 1, 1, 1], heightRatio: 1.0 },  // Row 2: Full solid forehead
  { cells: [1, 1, 0, 1, 0, 1, 1], heightRatio: 1.0 },  // Row 3: Eyes level (cutouts at col 2 & col 4)
  { cells: [1, 1, 1, 1, 1, 1, 1], heightRatio: 1.1 },  // Row 4: Upper Cheeks
  { cells: [1, 1, 1, 1, 1, 1, 1], heightRatio: 1.1 },  // Row 5: Lower Cheeks
  { cells: [1, 0, 0, 1, 0, 0, 1], heightRatio: 0.55 }, // Row 6: 3 Feet (Col 0, Col 3, Col 6)
  { cells: [0, 0, 0, 1, 0, 0, 0], heightRatio: 0.35 }, // Row 7: Center chin extension (Col 3)
];

const TOTAL_RATIO = LOGO_ROWS.reduce((sum, r) => sum + r.heightRatio, 0);

interface TarLogoProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function TarLogo({ size = 200, color = '#392878', style }: TarLogoProps) {
  const cellWidth = size / 7;
  const unitHeight = size / TOTAL_RATIO;

  return (
    <View style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}>
      {LOGO_ROWS.map((rowItem, rowIndex) => {
        const rowHeight = unitHeight * rowItem.heightRatio;
        return (
          <View
            key={rowIndex}
            style={{
              flexDirection: 'row',
              height: rowHeight,
              marginTop: rowIndex > 0 ? -0.5 : 0,
            }}
          >
            {rowItem.cells.map((cell, colIndex) => (
              <View
                key={colIndex}
                style={{
                  width: cell === 1 ? cellWidth + 0.5 : cellWidth,
                  height: cell === 1 ? rowHeight + 0.5 : rowHeight,
                  marginRight: cell === 1 ? -0.5 : 0,
                  backgroundColor: cell === 1 ? color : 'transparent',
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

export default TarLogo;
