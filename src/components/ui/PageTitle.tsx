const IS_DEV = process.env.NEXT_PUBLIC_ENV === 'development'

export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className={`text-2xl font-bold ${IS_DEV ? 'text-yellow-500' : 'text-gray-900'}`}>
      {children}
    </h1>
  )
}
