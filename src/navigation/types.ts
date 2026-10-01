export type RootStackParamList = {
  Tabs: undefined;
  // Messaging (existing).
  ChatRoom: { chatId: string; title: string };
  NewChat: undefined;
  // Social.
  PostDetail: { postId: string };
  UserProfile: { username: string };
  EditProfile: undefined;
  UserList: { username: string; mode: 'followers' | 'following' };
  // Monetization.
  Store: undefined;
  AdminRevenue: undefined;
  Settings: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Discover: undefined;
  NewPost: undefined;
  Chats: undefined;
  Profile: undefined;
};
