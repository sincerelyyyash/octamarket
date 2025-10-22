import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';

const { width, height } = Dimensions.get('window');

// Figma glow effect assets (keeping for decorative elements)
const imgShape = "http://localhost:3845/assets/6cb3c5bac76a4789fd1502b5482b9b0ec8e24137.svg";
const imgShape1 = "http://localhost:3845/assets/5510f0f2126405b299765309e23fa6406e67975c.svg";
const imgShape2 = "http://localhost:3845/assets/b58de80462c0d73ff007fba361b02d166d1d1987.svg";
const imgShape3 = "http://localhost:3845/assets/c68e90568116a3ab34e458803a40e24aad07d2e6.svg";
const imgShape4 = "http://localhost:3845/assets/e731b0ebf5ba296624d31f27a838a5b8b1c9c0eb.svg";
const imgShape5 = "http://localhost:3845/assets/0ac4f1d08d3cadcdcc195f970b34ca2abf73fdd1.svg";
const imgShape6 = "http://localhost:3845/assets/5e46bc3f1ca07c5f2d6dba3e953d346e92402eeb.svg";
const imgShape7 = "http://localhost:3845/assets/ebf5746c099797f6afd6706c77573413c7e10848.svg";
const imgShape8 = "http://localhost:3845/assets/2c2d9e1212f9ddd8cd51df246b2a12d1eead7b92.svg";

export default function OnboardingScreen() {
  const glowAnimation = useRef(new Animated.Value(0)).current;
  
  // Load DM Mono fonts
  const [fontsLoaded] = useFonts({
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    // Create a pulsing animation for the glow effects
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [glowAnimation]);

  const handleGetStarted = async () => {
    try {
      // Mark onboarding as completed
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      // Still navigate even if storage fails
      router.replace('/(tabs)');
    }
  };

  // Show loading while fonts are loading
  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient
          colors={['#090c15', '#080b17']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        />
        <Text style={[styles.title, { fontFamily: 'System' }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#090c15', '#080b17']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      />
      
      {/* Background image overlay */}
      <View style={styles.backgroundImageOverlay}>
        <Image 
          source={require('@/assets/images/onboard.png')}
          style={styles.backgroundImage}
          resizeMode="stretch"
        />
      </View>

      {/* Glow effects - First group */}
      <View style={styles.glowContainer1}>
        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape1,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.6],
              }),
              transform: [
                { rotate: '225deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape }} style={styles.glowImage} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape2,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
              transform: [
                { rotate: '165deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1.1],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape1 }} style={styles.glowImage} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape3,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.5],
              }),
              transform: [
                { rotate: '345.49deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1.3],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape2 }} style={styles.glowImage} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape4,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 0.8],
              }),
              transform: [
                { rotate: '45deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape3 }} style={styles.glowImage} />
        </Animated.View>
      </View>

      {/* Glow effects - Second group */}
      <View style={styles.glowContainer2}>
        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape5,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.6],
              }),
              transform: [
                { rotate: '270deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape4 }} style={styles.glowImage} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape6,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
              transform: [
                { rotate: '210deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1.1],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape5 }} style={styles.glowImage} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape7,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.5],
              }),
              transform: [
                { rotate: '30.49deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1.3],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape6 }} style={styles.glowImage} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape8,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 0.8],
              }),
              transform: [
                { rotate: '135.071deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape7 }} style={styles.glowImage} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.glowShape,
            styles.glowShape9,
            {
              opacity: glowAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.6],
              }),
              transform: [
                { rotate: '90deg' },
                {
                  scale: glowAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                },
              ],
            },
          ]} 
        >
          <Image source={{ uri: imgShape8 }} style={styles.glowImage} />
        </Animated.View>
      </View>

      {/* Prediction Market tag */}
      <View style={styles.tagContainer}>
        <Text style={styles.tagText}>Prediction Market</Text>
      </View>

      {/* Main title */}
      <Text style={styles.title}>Octamarket</Text>

      {/* Description */}
      <Text style={styles.description}>
        Send and receive money worldwide in just one click. Try it now and appreciate the convenience and benefits of this feature
      </Text>

      {/* Progress indicators */}
      <View style={styles.progressContainer}>
        <View style={styles.progressDot} />
        <View style={[styles.progressDot, styles.progressDotInactive]} />
        <View style={[styles.progressDot, styles.progressDotInactive]} />
        <View style={[styles.progressDot, styles.progressDotInactive]} />
      </View>

      {/* CTA Button */}
      <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
        <Text style={styles.buttonText}>Let's Start</Text>
      </TouchableOpacity>

      {/* Border overlay */}
      <View style={styles.borderOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090c15',
    position: 'relative',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: '110%',
    height: '110%',
  },
  glowContainer1: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glowContainer2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glowShape: {
    position: 'absolute',
  },
  glowImage: {
    width: '100%',
    height: '100%',
  },
  // First group glow shapes
  glowShape1: {
    width: 378.938,
    height: 456.347,
    left: -277.53,
    top: 332.56,
  },
  glowShape2: {
    width: 378.643,
    height: 337.947,
    left: -95.75,
    top: 549.84,
  },
  glowShape3: {
    width: 633.43,
    height: 309.638,
    left: -134.64,
    top: 591.62,
  },
  glowShape4: {
    width: 477.727,
    height: 313.324,
    left: -77.09,
    top: 467.06,
  },
  // Second group glow shapes
  glowShape5: {
    width: 235.116,
    height: 283.146,
    left: -187.23,
    top: 572.37,
  },
  glowShape6: {
    width: 234.933,
    height: 209.683,
    left: -243.49,
    top: 442,
  },
  glowShape7: {
    width: 393.019,
    height: 192.118,
    left: -298.15,
    top: 469.9,
  },
  glowShape8: {
    width: 330.912,
    height: 360.727,
    left: -432,
    top: 448.4,
  },
  glowShape9: {
    width: 296.411,
    height: 194.405,
    left: -148.35,
    top: 468.07,
  },
  tagContainer: {
    position: 'absolute',
    left: 20,
    top: 507,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tagText: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 14,
    color: '#000001',
    lineHeight: 20,
    letterSpacing: -0.28,
  },
  title: {
    position: 'absolute',
    left: 20,
    top: 551,
    fontFamily: 'DMMono_400Regular',
    fontSize: 48,
    color: '#ffffff',
    lineHeight: 48,
    letterSpacing: 0,
  },
  description: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 615,
    fontFamily: 'DMMono_400Regular',
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
    letterSpacing: -0.28,
  },
  progressContainer: {
    position: 'absolute',
    left: 20,
    top: 704,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 24,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  progressDotInactive: {
    width: 8,
    backgroundColor: '#62748e',
  },
  button: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 738,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
    letterSpacing: 0.32,
    textAlign: 'center',
    flex: 1,
  },
  borderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3.71,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 0.6,
  },
});
