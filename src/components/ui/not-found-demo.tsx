import { NotFound, Illustration } from "@/components/ui/not-found"

export function Demo({ onTakeHome, onGoBack }: { onTakeHome?: () => void; onGoBack?: () => void }) {
  return (
    <div className="relative flex flex-col w-full justify-center min-h-[75vh] p-6 md:p-10">
      <div className="relative max-w-5xl mx-auto w-full">
        <Illustration className="absolute inset-0 w-full h-[50vh] opacity-[0.05] text-slate-800 pointer-events-none" />
        <NotFound
          title="Page not found"
          description="Lost, this page is. In another system, it may be."
          onTakeHome={onTakeHome}
          onGoBack={onGoBack}
        />
      </div>
    </div>
  )
}
