import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '@/theme';
import { AuthScreen } from '@/screens/AuthScreen';
import { FeedScreen } from '@/screens/FeedScreen';
import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { NewPostScreen } from '@/screens/NewPostScreen';
import { PostDetailScreen } from '@/screens/PostDetailScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { EditProfileScreen } from '@/screens/EditProfileScreen';
import { UserListScreen } from '@/screens/UserListScreen';
import { AdminRevenueScreen } from '@/screens/AdminRevenueScreen';
import { ChatListScreen } from '@/screens/ChatListScreen';
import { ChatRoomScreen } from '@/screens/ChatRoomScreen';
import { NewChatScreen } from '@/screens/NewChatScreen';
import { StoreScreen } from '@/screens/StoreScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { useAuthStore } from '@/store/useAuthStore';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.surface,
    primary: theme.colors.primary,
    text: theme.colors.text,
    border: theme.colors.border,
  },
};

function tabIcon(label: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ color, fontSize: 18 }}>{label}</Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        headerStyle: { backgroundColor: theme.colors.primaryDark },
        headerTintColor: '#fff',
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{ title: 'Protogram', tabBarIcon: tabIcon('🏠') }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ tabBarIcon: tabIcon('🔍') }}
      />
      <Tab.Screen
        name="NewPost"
        component={NewPostScreen}
        options={{ title: 'New post', tabBarIcon: tabIcon('➕') }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{ tabBarIcon: tabIcon('💬') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.primaryDark },
          headerTintColor: '#fff',
        }}
      >
        {token ? (
          <>
            <Stack.Screen
              name="Tabs"
              component={Tabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PostDetail"
              component={PostDetailScreen}
              options={{ title: 'Post' }}
            />
            <Stack.Screen
              name="UserProfile"
              component={ProfileScreen}
              options={{ title: 'Profile' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ title: 'Edit profile' }}
            />
            <Stack.Screen
              name="UserList"
              component={UserListScreen}
              options={{ title: '' }}
            />
            <Stack.Screen
              name="AdminRevenue"
              component={AdminRevenueScreen}
              options={{ title: 'Revenue' }}
            />
            <Stack.Screen
              name="Store"
              component={StoreScreen}
              options={{ title: 'Go Pro' }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
            <Stack.Screen
              name="NewChat"
              component={NewChatScreen}
              options={{ title: 'New chat' }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Tabs"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
