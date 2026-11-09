import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { LinearTransition, ReduceMotion, useAnimatedStyle, withTiming } from "react-native-reanimated";

import { makeStyles, radius, fonts, spacing, useTheme } from "@/src/theme";

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
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.row} testID="filter-chip-row">
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <InteractiveFilterChip
            key={opt.key}
            label={opt.label}
            selected={selected}
            testID={`filter-chip-${opt.key}`}
            onPress={() => onChange(opt.key)}
          />
        );
      })}
    </ScrollView>
  );
}

function InteractiveFilterChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const background = useAnimatedStyle(() => ({
    backgroundColor: withTiming(selected ? colors.surfaceInverse : colors.surface, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    }),
    borderColor: withTiming(selected ? colors.surfaceInverse : colors.border, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    }),
  }), [colors.border, colors.surface, colors.surfaceInverse, selected]);
  const foreground = useAnimatedStyle(() => ({
    color: withTiming(selected ? colors.onSurfaceInverse : colors.onSurfaceTertiary, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    }),
  }), [colors.onSurfaceInverse, colors.onSurfaceTertiary, selected]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <Animated.View
        layout={LinearTransition.duration(180).reduceMotion(ReduceMotion.System)}
        style={[styles.pressable, background]}
      >
        <Animated.Text style={[styles.label, styles.pressableLabel, foreground]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pressableLabel: {
    lineHeight: 34,
    textAlign: "center",
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
  },
}));

export default FilterChipRowInteractive;
