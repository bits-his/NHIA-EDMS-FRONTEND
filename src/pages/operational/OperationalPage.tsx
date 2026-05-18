import { Navigate, useLocation } from 'react-router-dom';

/** Legacy route — personal and organisation performance live under `/performance`. */
export default function OperationalPage() {
  const location = useLocation();
  const search = location.search || '';
  const tab = new URLSearchParams(search).get('tab');
  const target =
    tab === 'team' ? '/performance?tab=organization' : `/performance${search}`;
  return <Navigate to={target} replace />;
}
