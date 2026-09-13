import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAuth } from "@/providers/auth-provider";

export default function AppTabs() {
  const { user } = useAuth();

  const isAdmin =
    user?.role === "ADMIN" &&
    user.approval_status === "APPROVED";

  return (
    <NativeTabs
      key={isAdmin ? "admin-tabs" : "member-tabs"}
      backgroundColor="#FFFFFF"
      indicatorColor="#DDF3E4"
      iconColor={{
        default: "#7A887F",
        selected: "#176B43",
      }}
      labelStyle={{
        default: { color: "#7A887F" },
        selected: { color: "#176B43" },
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

      {isAdmin ? (
        <NativeTabs.Trigger name="admin-users">
          <NativeTabs.Trigger.Label>Users</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "person.2", selected: "person.2.fill" }}
            md="group"
          />
        </NativeTabs.Trigger>
      ) : null}

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