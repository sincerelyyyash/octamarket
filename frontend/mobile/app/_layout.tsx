import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { ImageBackground, StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Removed anchor to allow proper onboarding flow

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const isOnboarding = pathname?.includes('onboarding');
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: 'transparent',
      card: 'transparent',
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <View style={styles.container}>
        {isOnboarding ? (
          <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="reset-onboarding" options={{ title: 'Reset Onboarding' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        ) : (
          <ImageBackground
            source={require('@/assets/images/market.png')}
            style={styles.container}
            imageStyle={styles.backgroundImage}
          >
            <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="reset-onboarding" options={{ title: 'Reset Onboarding' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
          </ImageBackground>
        )}
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
    opacity: 0.98,
  },
});
