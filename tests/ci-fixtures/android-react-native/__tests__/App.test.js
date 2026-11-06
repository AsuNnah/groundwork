import { render, screen } from '@testing-library/react-native';
import App, { greet } from '../App';

test('greet names the platform', () => {
  expect(greet('Android')).toBe('Hello from Android');
});

test('the app shows the greeting', async () => {
  await render(<App />);
  expect(screen.getByTestId('greeting')).toHaveTextContent('Hello from React Native');
});
