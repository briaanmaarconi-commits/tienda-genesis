import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useShopData";
import { Skeleton } from "@/components/ui/skeleton";

const Logo = () => {
  const { data, isLoading } = useSiteSettings();

  if (isLoading) {
    return (
      <Link to="/" className="flex items-center gap-2 min-w-0">
        <Skeleton className="h-8 w-28 rounded-md" />
      </Link>
    );
  }

  return (
    <Link to="/" className="flex items-center gap-2 min-w-0">
      {data?.logo_url ? (
        <img src={data.logo_url} alt={data?.site_name || "Logo"} className="h-10 w-auto object-contain" />
      ) : (
        <>
          <span className="text-2xl font-extrabold tracking-tight text-primary">
            {data?.site_name?.split(" ")[0]}
          </span>
          <span className="text-2xl font-extrabold tracking-tight">
            {data?.site_name?.split(" ").slice(1).join(" ")}
          </span>
        </>
      )}
    </Link>
  );
};

export default Logo;
