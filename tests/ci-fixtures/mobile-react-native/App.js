import { Text, View } from 'react-native';

export const greet = name => `Hello from ${name}`;

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text testID="greeting">{greet('React Native')}</Text>
    </View>
  );
}
