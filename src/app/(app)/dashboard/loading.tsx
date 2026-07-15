import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-7 w-10" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle><Skeleton className="h-5 w-32" /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
