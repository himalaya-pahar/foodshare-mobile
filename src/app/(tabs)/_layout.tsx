import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAuth } from "@/providers/auth-provider";

export default function TabsLayout() {
  const { user } = useAuth();
  const isApproved =
    user?.status === "active" ||
    (!user?.status && user?.approval_status === "APPROVED");
  const isAdmin = user?.role === "ADMIN" && isApproved;
  const isRestaurant = user?.role === "RESTAURANT" && isApproved;
  const isNgo = user?.role === "NGO" && isApproved;

  return (
    <NativeTabs
      backgroundColor="#FFFFFF"
      disableIndicator
      iconColor={{
        default: "#8A9690",
        selected: "#16673E",
      }}
      labelStyle={{
        default: { color: "#8A9690" },
        selected: { color: "#16673E", fontWeight: "700" },
      }}
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md="dashboard"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="donations" hidden={!isRestaurant}>
        <NativeTabs.Trigger.Label>Donations</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "takeoutbag.and.cup.and.straw",
            selected: "takeoutbag.and.cup.and.straw.fill",
          }}
          md="volunteer_activism"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="pickups" hidden={!isNgo}>
        <NativeTabs.Trigger.Label>Pickups</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "hands.clap", selected: "hands.clap.fill" }}
          md="local_shipping"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "clock.arrow.circlepath", selected: "clock.arrow.circlepath" }}
          md="history"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="admin-users" hidden={!isAdmin}>
        <NativeTabs.Trigger.Label>Users</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
          md="group"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          md="person"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
