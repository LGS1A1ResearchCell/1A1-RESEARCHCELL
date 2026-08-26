import { LoginPanel } from "@/components/site/LoginPanel";

export const metadata = { title: "Admin Login" };

export default function AdminLoginPage() {
  return (
    <LoginPanel
      audience="Research Cell leadership and school administration"
      heading="Admin Login"
      description="Sign in to review submissions, manage journals and administer the Research Cell."
      footer={
        <p className="text-sm leading-relaxed text-ink-body">
          Administrative accounts are created by the school. There is no
          self-registration for leadership or administration.
        </p>
      }
    />
  );
}
