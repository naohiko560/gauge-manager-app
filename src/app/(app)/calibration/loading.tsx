import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-36" />
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-5">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-12" />
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
