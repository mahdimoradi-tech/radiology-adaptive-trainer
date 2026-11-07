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
import { ReportPage } from '../pages/resident/ReportPage.jsx';
import { ReviewPage } from '../pages/resident/ReviewPage.jsx';
import { ProgressPage } from '../pages/resident/ProgressPage.jsx';
import { PracticeHomePage } from '../pages/resident/PracticeHomePage.jsx';
import { PracticeSetPage } from '../pages/resident/PracticeSetPage.jsx';
import { InstructorHomePage } from '../pages/instructor/InstructorHomePage.jsx';
import { InstructorReviewPage } from '../pages/instructor/InstructorReviewPage.jsx';
import { InstructorResidentsPage } from '../pages/instructor/InstructorResidentsPage.jsx';
import { ResidentDetailPage } from '../pages/instructor/ResidentDetailPage.jsx';
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
            element: <ReportPage />,
          },
          {
            path: 'reports/:sessionId/review',
            element: <ReviewPage />,
          },
          { path: 'practice', element: <PracticeHomePage /> },
          { path: 'practice/:setId', element: <PracticeSetPage /> },
          { path: 'progress', element: <ProgressPage /> },
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
            element: <InstructorReviewPage />,
          },
          {
            path: 'residents',
            element: <InstructorResidentsPage />,
          },
          {
            path: 'residents/:userId',
            element: <ResidentDetailPage />,
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
