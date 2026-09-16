import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import {
  login,
  logout,
  restoreSession,
  updateMyProfile,
} from "../services/auth";
import type { ProfileUpdate, User } from "../types/auth";

type AuthStatus =
  | "restoring"
  | "signedIn"
  | "signedOut"
  | "restoreError";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  busy: boolean;
  sessionError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryRestore: () => Promise<void>;
  updateProfile: (profile: ProfileUpdate) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [busy, setBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(
    null,
  );

  // Run authentication operations in order so token changes cannot overlap.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const runOperation = useCallback(
    (operation: () => Promise<void>): Promise<void> => {
      const next = queue.current.then(async () => {
        setBusy(true);

        try {
          await operation();
        } finally {
          setBusy(false);
        }
      });

      // A failed operation must not block later operations.
      queue.current = next.catch(() => undefined);

      return next;
    },
    [],
  );

  const retryRestore = useCallback(
    () =>
      runOperation(async () => {
        setStatus("restoring");
        setSessionError(null);

        try {
          const restoredUser = await restoreSession();

          setUser(restoredUser);
          setStatus(restoredUser ? "signedIn" : "signedOut");
        } catch (error) {
          setUser(null);
          setStatus("restoreError");
          setSessionError(
            error instanceof Error
              ? error.message
              : "Could not restore your session. Please try again.",
          );
        }
      }),
    [runOperation],
  );

  useEffect(() => {
    void retryRestore();
  }, [retryRestore]);

  const signIn = useCallback(
    (email: string, password: string) =>
      runOperation(async () => {
        const signedInUser = await login(email, password);

        setUser(signedInUser);
        setSessionError(null);
        setStatus("signedIn");
      }),
    [runOperation],
  );

  const signOut = useCallback(
    () =>
      runOperation(async () => {
        await logout();

        setUser(null);
        setSessionError(null);
        setStatus("signedOut");
      }),
    [runOperation],
  );

  const updateProfile = useCallback(
    (profile: ProfileUpdate) =>
      runOperation(async () => {
        const updatedUser = await updateMyProfile(profile);
        setUser(updatedUser);
      }),
    [runOperation],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        busy,
        sessionError,
        signIn,
        signOut,
        retryRestore,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
