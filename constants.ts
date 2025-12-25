
import { Prize } from './types';

export const PRIZE_CONFIG = [
  { 
    name: '10 Chai Nước Tăng Lực', 
    image: 'https://cdn-icons-png.flaticon.com/512/3041/3041130.png', 
    color: '#f59e0b', 
    type: 'food' as const,
    description: 'Năng lượng bùng nổ, quẩy xuyên màn đêm!',
    count: 10
  },
  { 
    name: '5 Thùng Mì Tôm', 
    image: 'https://cdn-icons-png.flaticon.com/512/3448/3448099.png', 
    color: '#ef4444', 
    type: 'food' as const,
    description: 'Cứu tinh cho những đêm cày game đói bụng!',
    count: 5
  },
  { 
    name: '5 Thùng Bia 333', 
    image: 'https://cdn-icons-png.flaticon.com/512/931/931949.png', 
    color: '#ef4444', 
    type: 'food' as const,
    description: 'Đậm đà hương vị Việt, cuộc vui thêm trọn vẹn!',
    count: 5
  },
  { 
    name: '5 Chai Nước Mắm', 
    image: 'https://cdn-icons-png.flaticon.com/512/3295/3295777.png', 
    color: '#8b5cf6', 
    type: 'food' as const,
    description: 'Gia vị quốc hồn quốc túy cho bữa cơm gia đình!',
    count: 5
  },
];

// Added PRIZES to satisfy Horse3D component requirements
export const PRIZES: Prize[] = [
  { id: 'p1', name: 'Nhất', image: '', color: '#fbbf24', type: 'money', description: 'Giải nhất', rank: 1, amount: '1M' },
  { id: 'p2', name: 'Nhì', image: '', color: '#cbd5e1', type: 'money', description: 'Giải nhì', rank: 2, amount: '500K' },
  { id: 'p3', name: 'Ba', image: '', color: '#b45309', type: 'money', description: 'Giải ba', rank: 3, amount: '200K' },
];

export const generateInitialPrizes = (): Prize[] => {
  const prizes: Prize[] = [];
  PRIZE_CONFIG.forEach((config, idx) => {
    for (let i = 0; i < config.count; i++) {
      prizes.push({
        id: `prize-${idx}-${i}`,
        name: config.name,
        image: config.image,
        color: config.color,
        type: config.type,
        description: config.description
      });
    }
  });
  return prizes.sort(() => Math.random() - 0.5);
};

export const COLORS = [
  '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6', '#10b981'
];
