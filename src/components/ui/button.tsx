import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"

    const variantStyles = {
      default: "bg-blue-600 text-white shadow hover:bg-blue-700",
      destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
      outline: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-100",
      secondary: "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200",
      ghost: "hover:bg-slate-100 hover:text-slate-900 text-slate-700",
      link: "text-blue-600 underline-offset-4 hover:underline"
    }[variant]

    const sizeStyles = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9"
    }[size]

    const combinedClass = cn(baseStyles, variantStyles, sizeStyles, className)

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: cn(combinedClass, (children as React.ReactElement<any>).props.className),
        ...props
      })
    }

    return (
      <button ref={ref} className={combinedClass} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
