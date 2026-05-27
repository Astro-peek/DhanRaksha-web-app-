import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChitFund from '../pages/ChitFund';

// Mock Auth Provider
vi.mock('../components/shared/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' }
  })
}));

// Mock realtime hooks and supabase
vi.mock('../hooks/useRealtime', () => ({
  useVaultRealtime: vi.fn(),
  useChitRealtime: vi.fn()
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: () => ({
      on: () => ({
        subscribe: () => ({})
      })
    }),
    removeChannel: () => ({})
  }
}));

// Mock lucide-react to save memory
vi.mock('lucide-react', () => ({
  Lock: () => <span>Lock</span>,
  ShieldCheck: () => <span>ShieldCheck</span>,
  ArrowUpRight: () => <span>ArrowUpRight</span>,
  ArrowDownLeft: () => <span>ArrowDownLeft</span>,
  Sparkles: () => <span>Sparkles</span>,
  Info: () => <span>Info</span>,
  HelpCircle: () => <span>HelpCircle</span>,
  ChevronDown: () => <span>ChevronDown</span>,
  ChevronUp: () => <span>ChevronUp</span>,
  Settings: () => <span>Settings</span>,
  AlertCircle: () => <span>AlertCircle</span>,
  Plus: () => <span>Plus</span>,
  Minus: () => <span>Minus</span>,
  CheckCircle2: () => <span>CheckCircle2</span>,
  ExternalLink: () => <span>ExternalLink</span>,
  ArrowRight: () => <span>ArrowRight</span>,
  Users: () => <span>Users</span>,
  Award: () => <span>Award</span>,
  TrendingUp: () => <span>TrendingUp</span>,
  DollarSign: () => <span>DollarSign</span>,
  Calendar: () => <span>Calendar</span>,
  Clock: () => <span>Clock</span>,
  FileText: () => <span>FileText</span>,
  Check: () => <span>Check</span>,
  Send: () => <span>Send</span>
}));

// Mock Language Store from correct lib path
vi.mock('../lib/languageStore', () => ({
  useLanguageStore: () => ({
    language: 'hi',
    lang: 'hi',
    t: (key) => key
  }),
  default: () => ({
    language: 'hi',
    lang: 'hi',
    t: (key) => key
  })
}));

// Mock router
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

describe('ChitFund Component', () => {
  test('renders the Chit Fund dashboard successfully', () => {
    render(<ChitFund />);
    const heading = screen.getByRole('heading');
    expect(heading).toBeDefined();
  });
});
