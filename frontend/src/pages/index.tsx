import { PageRoutes } from 'app/lib/routes'
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from 'app/lib/guards'
import AppShell from 'widgets/appShell'
import 'shared/config/fonts/fonts.scss'
import 'shared/config/global.scss'

const HomePage = lazy(() => import('./home'))
const MediaPage = lazy(() => import('./media'))
const AuthPage = lazy(() => import('./auth'))
const UploadPage = lazy(() => import('./upload'))
const ProfilePage = lazy(() => import('./profile'))
const AdminPage = lazy(() => import('./admin'))
const SearchHelpPage = lazy(() => import('./search-help'))
const NotFoundPage = lazy(() => import('./not-found'))

export default function Routing() {
  return (
    <AppShell>
      <Suspense fallback={<div className="empty-state">Загрузка...</div>}>
        <Routes>
          <Route path={PageRoutes.home} element={<HomePage />} />
          <Route path={PageRoutes.media} element={<MediaPage />} />
          <Route path={PageRoutes.login} element={<AuthPage mode="login" />} />
          <Route
            path={PageRoutes.register}
            element={<AuthPage mode="register" />}
          />
          <Route
            path={PageRoutes.upload}
            element={
              <RequireAuth>
                <UploadPage />
              </RequireAuth>
            }
          />
          <Route
            path={PageRoutes.profile}
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route path={PageRoutes.userProfile} element={<ProfilePage />} />
          <Route path={PageRoutes.searchHelp} element={<SearchHelpPage />} />
          <Route
            path={PageRoutes.admin}
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route
            path={PageRoutes.adminSection}
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route path={PageRoutes.notFound} element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
