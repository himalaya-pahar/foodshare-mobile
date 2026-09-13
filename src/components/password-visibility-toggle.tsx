import { Pressable, StyleSheet, View } from "react-native";

type PasswordVisibilityToggleProps = {
  visible: boolean;
  onPress: () => void;
};

export default function PasswordVisibilityToggle({
  visible,
  onPress,
}: PasswordVisibilityToggleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? "Hide password" : "Show password"}
      accessibilityHint="Toggles password visibility"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.eye}>
        <View style={styles.pupil} />
        {!visible ? <View style={styles.slash} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  eye: {
    width: 20,
    height: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#607468",
    borderRadius: 10,
  },
  pupil: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#607468",
  },
  slash: {
    position: "absolute",
    width: 24,
    height: 1.5,
    backgroundColor: "#607468",
    transform: [{ rotate: "-45deg" }],
  },
  pressed: {
    opacity: 0.58,
  },
});
