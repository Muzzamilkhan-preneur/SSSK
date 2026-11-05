import { BottomSheet } from "@/src/components/BottomSheet";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { clearSession } from "@/src/session";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

export function RoleSwitchButton() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable testID="switch-role-btn" onPress={() => setOpen(true)} style={styles.btn} hitSlop={8}>
        <Ionicons name="swap-horizontal" size={20} color={colors.onSurface} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Switch role?" testID="switch-role-sheet">
        <Text style={styles.note}>You will return to the role picker. Your reports and jobs stay saved.</Text>
        <View style={styles.actions}>
          <PrimaryButton
            title="Switch Role"
            icon="swap-horizontal"
            testID="switch-confirm-btn"
            onPress={async () => {
              await clearSession();
              setOpen(false);
              router.replace("/");
            }}
          />
          <PrimaryButton title="Stay Here" variant="ghost" testID="switch-cancel-btn" onPress={() => setOpen(false)} />
        </View>
      </BottomSheet>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    fontFamily: fonts.text,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.onSurfaceTertiary,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
}));
