import { ScrollView, Text, View } from "react-native";

import { makeStyles, radius, fonts, spacing, useTheme, withAlpha } from "@/src/theme";

export function FilterChipRow({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="filter-chip-row"
    >
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <View
            key={opt.key}
            testID={`filter-chip-${opt.key}`}
            style={[
              styles.chip,
              selected && { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
            ]}
            pointerEvents="none"
          >
            <Text style={[styles.label, { color: selected ? colors.onSurfaceInverse : colors.onSurfaceTertiary }]}>
              {opt.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// Pressable lives outside the row mapping so chips keep identical size in every state.
export function FilterChipRowInteractive({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.row} testID="filter-chip-row">
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <Text
            key={opt.key}
            testID={`filter-chip-${opt.key}`}
            onPress={() => onChange(opt.key)}
            style={[
              styles.pressable,
              styles.label,
              {
                backgroundColor: selected ? colors.surfaceInverse : "transparent",
                color: selected ? colors.onSurfaceInverse : colors.onSurfaceTertiary,
              },
            ]}
          >
            {opt.label}
          </Text>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  scroller: {
    marginHorizontal: -spacing.xl,
    flexGrow: 0,
    height: 44,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexShrink: 0,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pressable: {
    flexShrink: 0,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    lineHeight: 34,
    textAlign: "center",
    overflow: "hidden",
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
  },
}));

export default FilterChipRowInteractive;
