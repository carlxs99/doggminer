import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Toasts use the app's neon street look (dark card, green neon border + glow); styles live in src/styles.css (.dogg-toast).
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      offset={14}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "dogg-toast",
          title: "dogg-toast-title",
          description: "dogg-toast-desc",
          icon: "dogg-toast-icon",
          success: "dogg-toast-success",
          error: "dogg-toast-error",
          warning: "dogg-toast-warning",
          info: "dogg-toast-info",
          actionButton: "dogg-toast-action",
          cancelButton: "dogg-toast-cancel",
          closeButton: "dogg-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
