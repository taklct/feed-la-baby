import { FontAwesome6 } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAppDb as useSQLiteContext } from "../db/app-db";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "../constants/theme";
import { RemoteBaby, saveJoinedBaby } from "../db/babies";
import { getOrCreateLocalUser } from "../db/users";
import { supabase } from "../lib/supabase";
import { useI18n } from "../i18n/i18n";
import { type MessageKey } from "../i18n/messages";

const CODE_LENGTH = 6;
const MAX_FAILURES = 5;
const LOCK_MS = 60000;
const HERO_IMAGE_URI =
  "https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_bbbe0f6c05_17c722a7f1178c4b.png";
const WARM = "#A0603F";

type InvitedBaby = Pick<RemoteBaby, "id" | "name">;
type VerifyResult =
  | { ok: true; baby: InvitedBaby }
  | { ok: false; error: MessageKey };

// Invite codes are the first 6 characters of the baby id.
const verifyCode = async (code: string): Promise<VerifyResult> => {
  const { data, error } = await supabase
    .from("babies")
    .select("id, name")
    .ilike("id", `${code}%`)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: "join.network" };
  if (!data) return { ok: false, error: "join.invalid" };
  return { ok: true, baby: data };
};

export default function JoinBabyProfileScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { t } = useI18n();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<MessageKey | "">("");
  const [failures, setFailures] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [invitedBaby, setInvitedBaby] = useState<InvitedBaby | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [now, setNow] = useState(Date.now());

  const locked = now < lockedUntil;

  useEffect(() => {
    if (!locked) return;
    const timer = setTimeout(() => setNow(Date.now()), lockedUntil - now);
    return () => clearTimeout(timer);
  }, [locked, lockedUntil, now]);

  const canJoin = code.length === CODE_LENGTH && !verifying && !locked;

  const onCodeChange = (text: string) => {
    setCode(
      text
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, CODE_LENGTH),
    );
    setError("");
  };

  const onJoin = async () => {
    if (!canJoin) return;
    setVerifying(true);
    const result = await verifyCode(code);
    setVerifying(false);

    if (result.ok) {
      setFailures(0);
      setInvitedBaby(result.baby);
      setConfirmOpen(true);
      return;
    }

    const nextFailures = failures + 1;
    if (nextFailures >= MAX_FAILURES) {
      setFailures(0);
      setLockedUntil(Date.now() + LOCK_MS);
      setNow(Date.now());
      setError("join.tooMany");
      return;
    }
    setFailures(nextFailures);
    setError(result.error);
  };

  const onConfirmJoin = async () => {
    if (!invitedBaby) return;
    setJoining(true);
    const userId = await getOrCreateLocalUser(db);
    const { data, error: joinError } = await supabase.rpc("join_baby_by_code", {
      p_code: code,
      p_user_id: userId,
    });

    if (joinError || !data) {
      setJoining(false);
      setConfirmOpen(false);
      setError(
        joinError?.message.includes("invalid_code")
          ? "join.invalid"
          : "join.failed",
      );
      return;
    }

    await saveJoinedBaby(db, data as RemoteBaby);
    setConfirmOpen(false);
    setJoining(false);
    router.replace("/home");
  };

  const boxes = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? "");
  const activeIndex = Math.min(code.length, CODE_LENGTH - 1);
  const remainingSeconds = Math.ceil(Math.max(0, lockedUntil - now) / 1000);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.replace("/home")}
          style={styles.iconButton}
        >
          <FontAwesome6 name="arrow-left" size={15} color={COLORS.ink} />
        </Pressable>
        <Text style={styles.title}>{t("join.title")}</Text>
        <View style={styles.iconButtonSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroCard}>
            <Image
              source={{ uri: HERO_IMAGE_URI }}
              style={styles.heroImage}
              contentFit="cover"
              accessibilityLabel="Two caregivers smiling together while holding a baby"
            />
          </View>
          <Text style={styles.heroTitle}>{t("join.heroTitle")}</Text>
          <Text style={styles.heroBody}>{t("join.heroBody")}</Text>
        </View>

        <Text style={styles.label}>{t("join.codeLabel")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enter invitation code"
          onPress={() => inputRef.current?.focus()}
          style={styles.codeRow}
        >
          {boxes.map((char, i) => {
            const isActive = i === activeIndex && code.length < CODE_LENGTH;
            return (
              <View
                key={i}
                style={[
                  styles.codeBox,
                  char !== "" && styles.codeBoxFilled,
                  isActive && styles.codeBoxActive,
                  error !== "" && styles.codeBoxError,
                ]}
              >
                <Text style={styles.codeChar}>{char}</Text>
              </View>
            );
          })}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onCodeChange}
            editable={!verifying && !locked}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            onSubmitEditing={onJoin}
            returnKeyType="done"
            accessibilityLabel="Invitation code"
            style={styles.hiddenInput}
          />
        </Pressable>

        {error !== "" ? (
          <View style={styles.errorRow}>
            <FontAwesome6 name="circle-info" size={12} color={WARM} />
            <Text style={styles.errorText}>
              {locked
                ? t("join.lockedRemaining", {
                    error: t(error),
                    seconds: remainingSeconds,
                  })
                : t(error)}
            </Text>
          </View>
        ) : (
          <View style={styles.helpRow}>
            <FontAwesome6
              name="circle-question"
              size={12}
              color={COLORS.blue700}
            />
            <Text style={styles.helpText}>{t("join.help")}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={!canJoin}
          onPress={onJoin}
          style={[styles.joinButton, !canJoin && styles.joinButtonDisabled]}
        >
          {verifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.joinText}>{t("join.joinProfile")}</Text>
              <FontAwesome6 name="arrow-right" size={15} color="#FFFFFF" />
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/baby-setup")}
          style={styles.createLink}
        >
          <Text style={styles.createLinkText}>{t("join.createInstead")}</Text>
        </Pressable>
      </View>

      <Modal
        transparent
        animationType="slide"
        visible={confirmOpen}
        onRequestClose={() => setConfirmOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setConfirmOpen(false)}
        />
        <View style={[styles.sheet, styles.sheetCenter]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {t("join.confirmTitle", {
              name: invitedBaby?.name ?? t("join.thisBaby"),
            })}
          </Text>
          <View style={styles.babyAvatar}>
            <Text style={styles.babyAvatarText}>
              {invitedBaby?.name.charAt(0) ?? ""}
            </Text>
          </View>
          <Text style={styles.babyName}>{invitedBaby?.name ?? ""}</Text>
          <Text style={styles.sheetBody}>
            {t("join.confirmBody", {
              name: invitedBaby?.name ?? t("join.thisBaby"),
            })}
          </Text>
          <View style={styles.sharedChip}>
            <FontAwesome6 name="user-group" size={10} color={COLORS.blue800} />
            <Text style={styles.sharedChipText}>{t("join.caregiver")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={joining}
            onPress={onConfirmJoin}
            style={[styles.joinButton, styles.confirmButton]}
          >
            {joining ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.joinText}>{t("join.joinProfile")}</Text>
                <FontAwesome6 name="arrow-right" size={15} color="#FFFFFF" />
              </>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmOpen(false)}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </Modal>

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  iconButtonSpacer: {
    width: 44,
    height: 44,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.ink,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  hero: {
    alignItems: "center",
  },
  heroCard: {
    width: 248,
    height: 176,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: COLORS.blue50,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroTitle: {
    marginTop: 20,
    textAlign: "center",
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.ink,
  },
  heroBody: {
    marginTop: 8,
    maxWidth: 300,
    textAlign: "center",
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.muted,
  },
  label: {
    marginTop: 28,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  codeRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  codeBox: {
    flex: 1,
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  codeBoxFilled: {
    borderColor: COLORS.blue300,
    backgroundColor: "rgba(240, 246, 252, 0.4)",
  },
  codeBoxActive: {
    borderColor: COLORS.blue500,
  },
  codeBoxError: {
    borderColor: "#E3B9A2",
  },
  codeChar: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.ink,
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  helpRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  helpText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  errorRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FBF2EC",
  },
  errorText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
    color: WARM,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  joinButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.blue700,
  },
  joinButtonDisabled: {
    backgroundColor: COLORS.blueDisabled,
  },
  joinText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  createLink: {
    marginTop: 14,
    alignSelf: "center",
  },
  createLinkText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.blue700,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(47, 58, 53, 0.35)",
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
  },
  sheetCenter: {
    alignItems: "center",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.line,
  },
  sheetIcon: {
    marginTop: 20,
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.blue50,
  },
  sheetTitle: {
    marginTop: 12,
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.ink,
  },
  sheetBody: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: COLORS.muted,
  },
  signInList: {
    marginTop: 20,
    gap: 10,
  },
  signInButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  signInButtonDark: {
    borderColor: COLORS.ink,
    backgroundColor: COLORS.ink,
  },
  signInText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  signInTextDark: {
    color: "#FFFFFF",
  },
  sheetFootnote: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  babyAvatar: {
    marginTop: 20,
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.blue200,
  },
  babyAvatarText: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: COLORS.blue800,
  },
  babyName: {
    marginTop: 12,
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.ink,
  },
  babyAge: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.blue700,
  },
  sharedChip: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.blue50,
  },
  sharedChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.blue800,
  },
  confirmButton: {
    alignSelf: "stretch",
    marginTop: 24,
  },
  cancelButton: {
    height: 48,
    marginTop: 8,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  cancelText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.muted,
  },
});
