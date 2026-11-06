import { createRoot } from 'react-dom/client';
import { sum } from './sum.js';
createRoot(document.getElementById('root')).render(<h1>1 + 2 = {sum(1, 2)}</h1>);
