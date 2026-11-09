import { BottomSheet } from "@/src/components/BottomSheet";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { clearSession, getSession, saveCitizenProfile } from "@/src/session";
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
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Pressable testID="switch-role-btn" onPress={() => setOpen(true)} style={styles.btn} hitSlop={8}>
        <Ionicons name="swap-horizontal" size={20} color={colors.onSurface} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => { setOpen(false); setError(null); }} title="Switch role?" testID="switch-role-sheet">
        <Text style={styles.note}>You will return to the role picker. Your reports and jobs stay saved.</Text>
        {error ? <Text style={styles.error} testID="switch-role-error">{error}</Text> : null}
        <View style={styles.actions}>
          <PrimaryButton
            title="Switch Role"
            icon="swap-horizontal"
            testID="switch-confirm-btn"
            onPress={async () => {
              setError(null);
              try {
                const session = await getSession();
                if (session?.role === "citizen" && !(await saveCitizenProfile(session))) {
                  throw new Error("Your citizen profile could not be saved on this device. Please try again.");
                }
                if (!(await clearSession())) {
                  throw new Error("The current role could not be cleared. Please try again.");
                }
                setOpen(false);
                router.replace("/");
              } catch (switchError) {
                setError(switchError instanceof Error ? switchError.message : "Could not switch roles. Please try again.");
              }
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
  error: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
}));
