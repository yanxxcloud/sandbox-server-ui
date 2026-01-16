import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { SandboxList } from './pages/SandboxList';
import { SandboxDetail } from './pages/SandboxDetail';
import { CreateSandbox } from './pages/CreateSandbox';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<SandboxList />} />
            <Route path="/sandbox/:id" element={<SandboxDetail />} />
            <Route path="/create" element={<CreateSandbox />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
