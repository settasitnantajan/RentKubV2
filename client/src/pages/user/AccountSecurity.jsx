// /Users/duke/Documents/GitHub/RentKub/client/src/pages/user/AccountSecurity.jsx
import { UserProfile } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Define custom appearance object to match Shadcn styles
// You might need to adjust these based on your specific theme variables and desired look
const clerkAppearance = {
  // baseTheme: undefined, // Uncomment and set if you have a specific Clerk base theme
  variables: {
    // Map Clerk variables to your CSS variables (defined in globals.css or theme setup)
    // colorPrimary: 'hsl(var(--primary))', // Example: Use your primary color
    // colorText: 'hsl(var(--foreground))',
    // borderRadius: 'var(--radius)', // Example: Use your border radius variable
    // More variables: https://clerk.com/docs/components/customization/appearance#variables
  },
  elements: {
    // --- General Container ---
    rootBox: "w-full", // Ensure the root takes full width within the card
    card: "bg-transparent shadow-none border-none p-0 m-0", // Make Clerk's card blend into our Shadcn card

    // --- Header ---
    headerTitle: "text-xl font-semibold text-card-foreground",
    headerSubtitle: "text-sm text-muted-foreground",

    // --- Navigation (Sidebar) ---
    navbar: "border-r border-border", // Add border to match potential layouts
    navbarButton:
      "text-muted-foreground font-medium hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none rounded-md", // Style nav buttons like Shadcn sidebar links
    navbarButton__active: "bg-accent text-accent-foreground", // Active state

    // --- Content Sections ---
    profileSection: "p-0", // Remove default padding if needed, rely on CardContent
    profileSectionTitleText: "text-lg font-semibold text-card-foreground mb-4", // Style section titles
    profileSectionContent: "", // Add styles if needed

    // --- Form Elements ---
    formFieldLabel: "text-sm font-medium text-foreground mb-1 block", // Style form labels
    formInput:
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", // Mimic Shadcn Input
    formButtonPrimary:
      "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2", // Mimic Shadcn Button (Primary)
    formButtonReset:
      "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2", // Mimic Shadcn Button (Outline/Secondary)
    formFieldErrorText: "text-sm font-medium text-destructive", // Error text

    // --- Other Elements ---
    dividerLine: "bg-border", // Style dividers
    accordionTriggerButton: "w-full text-left text-card-foreground hover:bg-accent rounded-md p-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none", // Style accordion triggers

    // Add more element customizations as needed by inspecting the Clerk component
    // Full list: https://clerk.com/docs/components/customization/appearance#elements
  },
};


const AccountSecurity = () => {
  return (
    // Use a container that centers and sets max-width, responsive padding
    <section className="flex justify-center container mx-auto max-w-5xl mt-8 mb-8 px-4 sm:px-6 lg:px-8">
       {/* Use Shadcn Card as the main wrapper */}
       <Card className="w-fit"> {/* overflow-hidden helps if Clerk content tries to break out */}
         <CardHeader className="border-b border-border"> {/* Add border for visual separation */}
           <CardTitle className="text-2xl sm:text-3xl">Account Management</CardTitle>
           <CardDescription className="text-base">
             Manage your profile details, security settings (password, MFA), and connected accounts.
           </CardDescription>
         </CardHeader>
         {/* Apply padding within CardContent for the UserProfile component */}
         <CardContent className="p-4 sm:p-6 lg:p-8">
           {/* Pass the appearance object and routing props */}
           <UserProfile
             path="/user/account-security"
             routing="path"
             appearance={clerkAppearance} // Apply our custom styles
           />
         </CardContent>
       </Card>
    </section>
  );
};

export default AccountSecurity;
