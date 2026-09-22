import { ReactNode } from "react";

interface MobileFormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "number" | "textarea";
  placeholder?: string;
  icon?: ReactNode;
  required?: boolean;
}

export function MobileFormInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  icon,
  required,
}: MobileFormInputProps) {
  const baseStyles = "w-full px-4 py-3 md:py-2 border border-aura-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-aura-petrol-500 text-base md:text-sm";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-aura-graphite">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-3 md:top-2 text-aura-graphite-soft">
            {icon}
          </span>
        )}
        
        {type === "textarea" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${baseStyles} ${icon ? "pl-10" : ""} min-h-24`}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${baseStyles} ${icon ? "pl-10" : ""}`}
          />
        )}
      </div>
    </div>
  );
}