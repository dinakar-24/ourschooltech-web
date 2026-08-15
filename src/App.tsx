import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { ProtectedRoute, getRoleDashboard } from "@/components/auth/ProtectedRoute";
import { SubscriptionGuard } from "@/components/admin/SubscriptionGuard";
import { AdminPermissionGuard } from "@/components/admin/AdminPermissionGuard";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePrefetchRoutes } from "@/hooks/usePrefetchRoutes";
import { DynamicManifestHandler } from "@/components/pwa/DynamicManifestHandler";
import { InstallAppBanner } from "@/components/pwa/InstallAppBanner";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { friendlyErrorMessage } from "@/lib/error-utils";
import { logError } from "@/lib/logger";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AiChatFabLazy = lazy(() => import("@/components/ai/AiChatFab").then(m => ({ default: m.AiChatFab })));

// Eagerly loaded pages (small, needed immediately)
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import TenantErrorPage from "./pages/TenantErrorPage";
import SubdomainLanding from "./pages/login/SubdomainLanding";

const ReceiptVerificationPage = lazy(() => import("./pages/ReceiptVerificationPage"));
const SetPasswordPage = lazy(() => import("./pages/SetPasswordPage"));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"));
const PublicInstallPage = lazy(() => import("./pages/PublicInstallPage"));

// Lazy loaded pages -- Super Admin
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard"));
const SchoolsPage = lazy(() => import("./pages/super-admin/SchoolsPage"));
const SchoolAdminsPage = lazy(() => import("./pages/super-admin/SchoolAdminsPage"));
const AllUsersPage = lazy(() => import("./pages/super-admin/AllUsersPage"));
const PlatformUsersPage = lazy(() => import("./pages/super-admin/PlatformUsersPage"));
const SchoolUsersPage = lazy(() => import("./pages/super-admin/SchoolUsersPage"));
const SystemSettingsPage = lazy(() => import("./pages/super-admin/SystemSettingsPage"));
const SystemAnnouncementsPage = lazy(() => import("./pages/super-admin/SystemAnnouncementsPage"));
const AuditLogsPage = lazy(() => import("./pages/super-admin/AuditLogsPage"));
const SuperAdminReportsPage = lazy(() => import("./pages/super-admin/SuperAdminReportsPage"));
const SubscriptionsPage = lazy(() => import("./pages/super-admin/SubscriptionsPage"));
const SystemHealthPage = lazy(() => import("./pages/super-admin/SystemHealthPage"));


// Lazy loaded pages -- Admin
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const StudentsPage = lazy(() => import("./pages/admin/StudentsPage"));
const TeachersPage = lazy(() => import("./pages/admin/TeachersPage"));
const ClassesPage = lazy(() => import("./pages/admin/ClassesPage"));
const AttendancePage = lazy(() => import("./pages/admin/AttendancePage"));
const HolidayCalendarPage = lazy(() => import("./pages/admin/HolidayCalendarPage"));
const EmployeeAttendancePage = lazy(() => import("./pages/admin/EmployeeAttendancePage"));
const FeesPage = lazy(() => import("./pages/admin/FeesPage"));
const StudentFeesPage = lazy(() => import("./pages/admin/StudentFeesPage"));
const ExamsPage = lazy(() => import("./pages/admin/ExamsPage"));
const AnnouncementsPage = lazy(() => import("./pages/admin/AnnouncementsPage"));
const AcademicYearsPage = lazy(() => import("./pages/admin/AcademicYearsPage"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const AdminProfilePage = lazy(() => import("./pages/admin/AdminProfilePage"));
const SubscriptionPage = lazy(() => import("./pages/admin/SubscriptionPage"));
const TimetablePage = lazy(() => import("./pages/admin/TimetablePage"));
const BulkUploadPage = lazy(() => import("./pages/admin/BulkUploadPage"));
const OnlineClassesPage = lazy(() => import("./pages/admin/OnlineClassesPage"));
const TransportPage = lazy(() => import("./pages/admin/TransportPage"));

const GalleryPage = lazy(() => import("./pages/admin/GalleryPage"));
const FeedbackPage = lazy(() => import("./pages/admin/FeedbackPage"));
const QueryPage = lazy(() => import("./pages/admin/QueryPage"));
const InstallAppPage = lazy(() => import("./pages/admin/InstallAppPage"));

// Lazy loaded pages -- Teacher
const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherAttendance = lazy(() => import("./pages/teacher/TeacherAttendance"));
const TeacherHomework = lazy(() => import("./pages/teacher/TeacherHomework"));
const TeacherMarks = lazy(() => import("./pages/teacher/TeacherMarks"));
const TeacherProfile = lazy(() => import("./pages/teacher/TeacherProfile"));
const TeacherTimetable = lazy(() => import("./pages/teacher/TeacherTimetable"));
const TeacherAnnouncements = lazy(() => import("./pages/teacher/TeacherAnnouncements"));
const TeacherStudents = lazy(() => import("./pages/teacher/TeacherStudents"));
const TeacherOnlineClasses = lazy(() => import("./pages/teacher/TeacherOnlineClasses"));

const TeacherFeedback = lazy(() => import("./pages/teacher/TeacherFeedback"));
const TeacherQueries = lazy(() => import("./pages/teacher/TeacherQueries"));
const TeacherSettings = lazy(() => import("./pages/teacher/TeacherSettings"));

// Lazy loaded pages -- Parent
const ParentDashboard = lazy(() => import("./pages/parent/ParentDashboard"));
const ParentAttendance = lazy(() => import("./pages/parent/ParentAttendance"));
const ParentFees = lazy(() => import("./pages/parent/ParentFees"));
const ParentResults = lazy(() => import("./pages/parent/ParentResults"));
const ParentProfile = lazy(() => import("./pages/parent/ParentProfile"));
const ParentAnnouncements = lazy(() => import("./pages/parent/ParentAnnouncements"));
const ParentHomework = lazy(() => import("./pages/parent/ParentHomework"));
const ParentOnlineClasses = lazy(() => import("./pages/parent/ParentOnlineClasses"));
const ParentTransport = lazy(() => import("./pages/parent/ParentTransport"));

const ParentGallery = lazy(() => import("./pages/parent/ParentGallery"));
const ParentFeedback = lazy(() => import("./pages/parent/ParentFeedback"));
const ParentQueries = lazy(() => import("./pages/parent/ParentQueries"));
const ParentSettings = lazy(() => import("./pages/parent/ParentSettings"));
const ParentMorePage = lazy(() => import("./pages/parent/ParentMorePage"));

// Lazy loaded pages -- Student
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StudentAttendance = lazy(() => import("./pages/student/StudentAttendance"));
const StudentHomework = lazy(() => import("./pages/student/StudentHomework"));
const StudentResults = lazy(() => import("./pages/student/StudentResults"));
const StudentProfile = lazy(() => import("./pages/student/StudentProfile"));
const StudentTimetable = lazy(() => import("./pages/student/StudentTimetable"));
const StudentAnnouncements = lazy(() => import("./pages/student/StudentAnnouncements"));
const StudentSubjects = lazy(() => import("./pages/student/StudentSubjects"));
const StudentSettings = lazy(() => import("./pages/student/StudentSettings"));
const StudentOnlineClasses = lazy(() => import("./pages/student/StudentOnlineClasses"));
const StudentTransport = lazy(() => import("./pages/student/StudentTransport"));
const StudentGallery = lazy(() => import("./pages/student/StudentGallery"));

// Shared Pages
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minutes -- data stays fresh
      gcTime: 30 * 60 * 1000,          // 30 minutes -- unused cache kept
      refetchOnMount: true,            // render cache immediately, then refresh stale data in the background
      refetchOnWindowFocus: false,     // no refetch on tab switch
      refetchOnReconnect: true,        // refetch stale data when back online
      networkMode: 'offlineFirst',     // use cache when offline, fetch when online
      retry: (failureCount, error) => {
        const msg = (error as Error)?.message ?? '';
        // Never retry auth/client errors (4xx)
        if (/40[0-9]|unauthorized|forbidden|not found|already exists|validation/i.test(msg)) return false;
        // Retry up to 2x on network / server errors with backoff
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 8000),
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => {
        const msg = (error as Error)?.message ?? '';
        if (/40[0-9]|unauthorized|forbidden|already exists|validation/i.test(msg)) return false;
        return failureCount < 1;
      },
      onError: (error: Error) => {
        logError('mutation', error.message, { source: 'global_mutation_handler' });
        toast.error(friendlyErrorMessage(error.message));
      },
    },
  },
});

// Persist React Query cache to IndexedDB for instant loading on repeat visits
const shouldPersistQuery = (query: any) => {
  const key = query?.queryKey?.[0];
  return ![
    'fees',
    'fee-invoices',
    'student-fee-invoices',
    'audit-logs',
    'error-logs-health',
    'login-attempts-health',
    'recent-jobs',
  ].includes(key);
};

const idbPersister = {
  persistClient: async (client: any) => {
    const dehydratedState = client?.clientState as DehydratedState | undefined;
    const trimmedClient = dehydratedState
      ? {
          ...client,
          clientState: {
            ...dehydratedState,
            queries: dehydratedState.queries.filter((query) => shouldPersistQuery(query)),
          },
        }
      : client;

    await set('react-query-cache', trimmedClient);
  },
  restoreClient: async () => {
    return await get('react-query-cache');
  },
  removeClient: async () => {
    await del('react-query-cache');
  },
};

persistQueryClient({
  queryClient: queryClient as any,
  persister: idbPersister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  buster: '', // change to bust cache on major updates
});

function RouteLoadingFallback() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center gap-4 bg-background">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="29" fill="#fff" stroke="#5a5ce6" strokeWidth="3" />
        <circle cx="32" cy="32" r="6" fill="#000" style={{ animation: 'eyeOrbit 1.4s linear infinite' }} />
      </svg>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="29" fill="#fff" stroke="#5a5ce6" strokeWidth="3" />
        <circle cx="32" cy="32" r="6" fill="#000" style={{ animation: 'eyeOrbit 1.4s linear 0.2s infinite' }} />
      </svg>
    </div>
  );
}

// Smart redirect based on auth state
function AuthRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { isSubdomain } = useTenant();
  
  if (isLoading) {
    return <RouteLoadingFallback />;
  }
  
  if (isAuthenticated && user) {
    return <Navigate to={getRoleDashboard(user.role)} replace />;
  }

  if (isSubdomain) {
    return <SubdomainLanding />;
  }
  
  return <Navigate to="/login" replace />;
}



// Predictive preloader -- silently loads role-specific chunks after login
function PrefetchHandler() {
  const { user } = useAuth();
  usePrefetchRoutes(user?.role);
  return null;
}

function AppRoutes() {
  const { isSubdomain, isLoading: tenantLoading, tenantError } = useTenant();

  if (tenantLoading) {
    return <RouteLoadingFallback />;
  }

  if (isSubdomain && tenantError) {
    return <TenantErrorPage message={tenantError} />;
  }

  return (
    <>
      <DynamicManifestHandler />
      <InstallAppBanner />
      
      <PrefetchHandler />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<AuthRedirect />} />
          <Route path="/receipt/:receiptNumber" element={<ReceiptVerificationPage />} />
          <Route path="/install" element={<PublicInstallPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
          
          <Route path="/login" element={isSubdomain ? <Navigate to="/" replace /> : <LoginPage />} />

          {isSubdomain && (
            <>
              <Route path="/admin" element={<AuthRedirect />} />
              <Route path="/teacher" element={<AuthRedirect />} />
              <Route path="/parent" element={<AuthRedirect />} />
              <Route path="/student" element={<AuthRedirect />} />
            </>
          )}

          {/* Super Admin Routes */}
          {isSubdomain ? (
            <Route path="/super-admin/*" element={<TenantErrorPage message="Super Admin access is not available on school subdomains." />} />
          ) : (
            <>
              <Route path="/super-admin/dashboard" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
              <Route path="/super-admin/schools" element={<ProtectedRoute allowedRoles={['super_admin']}><SchoolsPage /></ProtectedRoute>} />
              <Route path="/super-admin/admins" element={<ProtectedRoute allowedRoles={['super_admin']}><SchoolAdminsPage /></ProtectedRoute>} />
              <Route path="/super-admin/users" element={<ProtectedRoute allowedRoles={['super_admin']}><AllUsersPage /></ProtectedRoute>} />
              <Route path="/super-admin/platform-users" element={<ProtectedRoute allowedRoles={['super_admin']}><PlatformUsersPage /></ProtectedRoute>} />
              
              <Route path="/super-admin/schools/:schoolId" element={<ProtectedRoute allowedRoles={['super_admin']}><SchoolUsersPage /></ProtectedRoute>} />
              <Route path="/super-admin/announcements" element={<ProtectedRoute allowedRoles={['super_admin']}><SystemAnnouncementsPage /></ProtectedRoute>} />
              <Route path="/super-admin/subscriptions" element={<ProtectedRoute allowedRoles={['super_admin']}><SubscriptionsPage /></ProtectedRoute>} />
              <Route path="/super-admin/reports" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminReportsPage /></ProtectedRoute>} />
              <Route path="/super-admin/audit-logs" element={<ProtectedRoute allowedRoles={['super_admin']}><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/super-admin/system-health" element={<ProtectedRoute allowedRoles={['super_admin']}><SystemHealthPage /></ProtectedRoute>} />
              <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={['super_admin']}><SystemSettingsPage /></ProtectedRoute>} />
              
              <Route path="/super-admin/*" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
            </>
          )}
          
          {/* School Admin Routes -- one persistent AdminLayout wraps all of
              these via Outlet (sidebar/topbar never remounts on nav between
              them); each child keeps its exact pre-existing guard chain
              unchanged (e.g. Subscription deliberately skips SubscriptionGuard
              so an unpaid school can still reach it to pay) -- only the
              layout nests here, not the guards. */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminDashboard /></SubscriptionGuard></ProtectedRoute>} />
            <Route path="students" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><StudentsPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="teachers" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><TeachersPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="classes" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><ClassesPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="attendance" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><AttendancePage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="holiday-calendar" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><HolidayCalendarPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="employee-attendance" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><EmployeeAttendancePage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="fees" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><FeesPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="fees/:studentId" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><StudentFeesPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="exams" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><ExamsPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="academic-years" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><AcademicYearsPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="timetable" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><TimetablePage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="announcements" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><AnnouncementsPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><ReportsPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><SettingsPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminProfilePage /></SubscriptionGuard></ProtectedRoute>} />
            <Route path="subscription" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><AdminPermissionGuard><SubscriptionPage /></AdminPermissionGuard></ProtectedRoute>} />
            <Route path="bulk-upload" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><BulkUploadPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="online-classes" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><OnlineClassesPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="transport" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><TransportPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="gallery" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><GalleryPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="feedback" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><FeedbackPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="queries" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><QueryPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="students/bulk-upload" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminPermissionGuard><BulkUploadPage /></AdminPermissionGuard></SubscriptionGuard></ProtectedRoute>} />
            <Route path="notifications" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminNotificationsPage /></SubscriptionGuard></ProtectedRoute>} />
            <Route path="install-app" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><InstallAppPage /></SubscriptionGuard></ProtectedRoute>} />
            <Route path="*" element={<ProtectedRoute allowedRoles={['school_admin', 'super_admin']} requireImpersonation><SubscriptionGuard><AdminDashboard /></SubscriptionGuard></ProtectedRoute>} />
          </Route>
          
          {/* Teacher Routes */}
          <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAttendance /></ProtectedRoute>} />
          <Route path="/teacher/homework" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherHomework /></ProtectedRoute>} />
          <Route path="/teacher/marks" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherMarks /></ProtectedRoute>} />
          <Route path="/teacher/timetable" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherTimetable /></ProtectedRoute>} />
          <Route path="/teacher/announcements" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherAnnouncements /></ProtectedRoute>} />
          <Route path="/teacher/students" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherStudents /></ProtectedRoute>} />
          <Route path="/teacher/profile" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherProfile /></ProtectedRoute>} />
          <Route path="/teacher/online-classes" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherOnlineClasses /></ProtectedRoute>} />
          <Route path="/teacher/notifications" element={<ProtectedRoute allowedRoles={['teacher']}><NotificationsPage /></ProtectedRoute>} />
          
          <Route path="/teacher/feedback" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherFeedback /></ProtectedRoute>} />
          <Route path="/teacher/queries" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherQueries /></ProtectedRoute>} />
          <Route path="/teacher/settings" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherSettings /></ProtectedRoute>} />
          <Route path="/teacher/*" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
          
          {/* Parent Routes */}
          <Route path="/parent/dashboard" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
          <Route path="/parent/attendance" element={<ProtectedRoute allowedRoles={['parent']}><ParentAttendance /></ProtectedRoute>} />
          <Route path="/parent/homework" element={<ProtectedRoute allowedRoles={['parent']}><ParentHomework /></ProtectedRoute>} />
          <Route path="/parent/fees" element={<ProtectedRoute allowedRoles={['parent']}><ParentFees /></ProtectedRoute>} />
          <Route path="/parent/results" element={<ProtectedRoute allowedRoles={['parent']}><ParentResults /></ProtectedRoute>} />
          <Route path="/parent/announcements" element={<ProtectedRoute allowedRoles={['parent']}><ParentAnnouncements /></ProtectedRoute>} />
          <Route path="/parent/profile" element={<ProtectedRoute allowedRoles={['parent']}><ParentProfile /></ProtectedRoute>} />
          <Route path="/parent/online-classes" element={<ProtectedRoute allowedRoles={['parent']}><ParentOnlineClasses /></ProtectedRoute>} />
          <Route path="/parent/transport" element={<ProtectedRoute allowedRoles={['parent']}><ParentTransport /></ProtectedRoute>} />
          <Route path="/parent/notifications" element={<ProtectedRoute allowedRoles={['parent']}><NotificationsPage /></ProtectedRoute>} />
          
          <Route path="/parent/gallery" element={<ProtectedRoute allowedRoles={['parent']}><ParentGallery /></ProtectedRoute>} />
          <Route path="/parent/feedback" element={<ProtectedRoute allowedRoles={['parent']}><ParentFeedback /></ProtectedRoute>} />
          <Route path="/parent/queries" element={<ProtectedRoute allowedRoles={['parent']}><ParentQueries /></ProtectedRoute>} />
          <Route path="/parent/settings" element={<ProtectedRoute allowedRoles={['parent']}><ParentSettings /></ProtectedRoute>} />
          <Route path="/parent/more" element={<ProtectedRoute allowedRoles={['parent']}><ParentMorePage /></ProtectedRoute>} />
          <Route path="/parent/*" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
          
          {/* Student Routes */}
          <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute allowedRoles={['student']}><StudentAttendance /></ProtectedRoute>} />
          <Route path="/student/homework" element={<ProtectedRoute allowedRoles={['student']}><StudentHomework /></ProtectedRoute>} />
          <Route path="/student/results" element={<ProtectedRoute allowedRoles={['student']}><StudentResults /></ProtectedRoute>} />
          <Route path="/student/timetable" element={<ProtectedRoute allowedRoles={['student']}><StudentTimetable /></ProtectedRoute>} />
          <Route path="/student/announcements" element={<ProtectedRoute allowedRoles={['student']}><StudentAnnouncements /></ProtectedRoute>} />
          <Route path="/student/subjects" element={<ProtectedRoute allowedRoles={['student']}><StudentSubjects /></ProtectedRoute>} />
          <Route path="/student/settings" element={<ProtectedRoute allowedRoles={['student']}><StudentSettings /></ProtectedRoute>} />
          <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfile /></ProtectedRoute>} />
          <Route path="/student/notifications" element={<ProtectedRoute allowedRoles={['student']}><NotificationsPage /></ProtectedRoute>} />
          <Route path="/student/online-classes" element={<ProtectedRoute allowedRoles={['student']}><StudentOnlineClasses /></ProtectedRoute>} />
          <Route path="/student/transport" element={<ProtectedRoute allowedRoles={['student']}><StudentTransport /></ProtectedRoute>} />
          <Route path="/student/gallery" element={<ProtectedRoute allowedRoles={['student']}><StudentGallery /></ProtectedRoute>} />
          <Route path="/student/*" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          
          {/* Legacy routes */}
          <Route path="/dashboard" element={<AuthRedirect />} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <TenantProvider>
            <AuthProvider>
              <ImpersonationProvider>
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
                <Suspense fallback={null}>
                  <AiChatFabLazy />
                </Suspense>
              </ImpersonationProvider>
            </AuthProvider>
          </TenantProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
