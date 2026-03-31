import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function GoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      toast.error('Google sign-in failed. Please try again.');
      navigate('/login');
      return;
    }

    if (token) {
      localStorage.setItem('tfw_token', token);
      refreshUser().then(() => {
        toast.success('Signed in with Google!');
        navigate('/');
      });
    } else {
      navigate('/login');
    }
  }, [params, navigate, refreshUser]);

  return (
    <div className="page-spinner">
      <div className="spinner" />
      <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Signing you in...</p>
    </div>
  );
}
