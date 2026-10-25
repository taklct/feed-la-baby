import { Component, Fragment, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null; attempt: number };

// On web, the database file can stay locked by another open tab; retrying remounts the provider.
export class DatabaseBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn("Database failed to open", error);
  }

  retry = () => {
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Could not open your data</Text>
          <Text style={styles.body}>
            Close other windows or tabs of this app, then try again.
          </Text>
          <Text style={styles.detail}>{this.state.error.message}</Text>
          <Pressable style={styles.button} onPress={this.retry}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 14, textAlign: "center", opacity: 0.7 },
  detail: { fontSize: 12, textAlign: "center", opacity: 0.5 },
  button: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
