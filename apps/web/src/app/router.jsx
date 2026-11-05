import { createBrowserRouter, Navigate } from 'react-router';
import { useMe } from '../features/auth/hooks.js';
import { Spinner } from '../components/ui/index.js';
import { PublicLayout } from './layouts/PublicLayout.jsx';
import { ResidentLayout } from './layouts/ResidentLayout.jsx';
import { InstructorLayout } from './layouts/InstructorLayout.jsx';
import { RequireRole } from './guards/RequireRole.jsx';
import { LoginPage } from '../pages/auth/LoginPage.jsx';
import { RegisterPage } from '../pages/auth/RegisterPage.jsx';
import { ResidentHomePage } from '../pages/resident/ResidentHomePage.jsx';
import { TestsPage } from '../pages/resident/TestsPage.jsx';
import { QuizPage } from '../pages/resident/QuizPage.jsx';
import { InstructorHomePage } from '../pages/instructor/InstructorHomePage.jsx';
import { ForbiddenPage } from '../pages/system/ForbiddenPage.jsx';
import { NotFoundPage } from '../pages/system/NotFoundPage.jsx';
import { PlaceholderPage } from '../pages/system/PlaceholderPage.jsx';

/**
 * Root landing redirector based on authentication and user role
 */
export function RootRedirect() {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'instructor' ? '/instructor' : '/app'} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    element: <PublicLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forbidden', element: <ForbiddenPage /> },
    ],
  },
  {
    path: 'app',
    element: <RequireRole allowedRoles={['resident']} />,
    children: [
      {
        element: <ResidentLayout />,
        children: [
          { index: true, element: <ResidentHomePage /> },
          { path: 'tests', element: <TestsPage /> },
          {
            path: 'tests/:sessionId',
            element: <QuizPage />,
          },
          {
            path: 'reports/:sessionId',
            element: <PlaceholderPage titleKey="nav.progress" task="T06" />,
          },
          { path: 'progress', element: <PlaceholderPage titleKey="nav.progress" task="T06" /> },
          { path: 'education', element: <PlaceholderPage titleKey="nav.education" task="T06" /> },
        ],
      },
    ],
  },
  {
    path: 'instructor',
    element: <RequireRole allowedRoles={['instructor']} />,
    children: [
      {
        element: <InstructorLayout />,
        children: [
          { index: true, element: <InstructorHomePage /> },
          {
            path: 'review',
            element: <PlaceholderPage titleKey="instructor.reviewTitle" task="T08" />,
          },
          {
            path: 'residents',
            element: <PlaceholderPage titleKey="instructor.residentsTitle" task="T08" />,
          },
          {
            path: 'catalog',
            element: <PlaceholderPage titleKey="instructor.catalogTitle" task="T08" />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <PublicLayout />,
    children: [{ path: '*', element: <NotFoundPage /> }],
  },
]);
