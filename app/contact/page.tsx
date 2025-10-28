import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ChatBubble from '@/components/ChatBubble'
import { Mail, Phone, Sparkle, Clock, MessageCircle, IceCreamCone, SquareUserRound } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl pt-10 font-bold tracking-tight">Contact</h1>
        <p className="text-muted-foreground">Contact Section for admin details, Request Resources, starBOT</p>
      </div>

      {/* Grid for Card 1 and Card 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: PEC.UP Admin's */}
        <Card>
          <CardHeader>
            <CardTitle>PEC.UP Admin's</CardTitle>
            <CardDescription>PEC.UP Details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <IceCreamCone className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">Yeswanth Madasu.</h3>
                <h3 className="text-muted-foreground h-10">CSE-B 3rd Year</h3>
                <p className="text-sm text-muted-foreground"><a href="https://yesh.pecup.in">website</a></p>
                <p className="text-sm text-muted-foreground"><a href="https://x.com">X</a></p>
                <p className="text-sm text-muted-foreground"><a href="https://google.com">Github</a></p>
                <p className="text-sm text-muted-foreground"><a href="https://google.com">Linkedin</a></p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <SquareUserRound className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">Venkatakumar G</h3>
                <h3 className="text-muted-foreground h-10">CSE-B 3rd Year</h3>
                <p className="text-sm text-muted-foreground"><a href="https://google.com">Linkedin</a></p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <SquareUserRound className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">KaavyaSri B</h3>
                <h3 className="text-muted-foreground h-10">CSE-B 3rd Year</h3>
                <p className="text-sm text-muted-foreground"><a href="https://google.com">Linkedin</a></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Resource Request */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Request</CardTitle>
            <CardDescription>Ways to reach the administration, for resource requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">Whatsapp</h3>
                <p className="text-sm text-muted-foreground"><a href="https://wa.me/919676242565">Request Resources</a></p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">Email</h3>
                <p className="text-sm text-muted-foreground">work.pecup@gmail.com</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkle className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">PEC.UP's Assistant</h3>
                <p className="text-sm text-muted-foreground"><a href="https://chat.pecup.in">starBOT</a></p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <SquareUserRound className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">Resource Request, Admin</h3>
                <p className="text-sm text-muted-foreground">VenkataKumar G</p>
                <p className="text-sm text-muted-foreground">CSE-B 3rd Year</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ Card (Centered, Full Width) */}
      <div className="flex justify-center mt-8">
        <Card className="w-full max-w-10xl">
          <CardHeader>
            <CardTitle>FAQ</CardTitle>
            <CardDescription>Frequently asked questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 p-3 rounded-md hover:bg-muted transition-all duration-200">
              <h3 className="font-medium text-primary">Will it cost Admins to run PEC.UP, starBOT?</h3>
              <p className="text-sm text-muted-foreground">
                It takes a lot of dedication and patience to manage PEC.UP and starBOt. But in terms of actual cost? Nope—just the domain renewal and thanks to Google's free tier for Gemini 2.0 flash API Credits.
              </p>
            </div>
            <div className="space-y-2 p-3 rounded-md hover:bg-muted transition-all duration-200">
              <h3 className="font-medium text-primary">Are PEC.UP's resources updated every day?</h3>
              <p className="text-sm text-muted-foreground">
                Not every day, but we update most resources weekly. So yeah, you can rely on us!
              </p>
            </div>
            <div className="space-y-2 p-3 rounded-md hover:bg-muted transition-all duration-200">
              <h3 className="font-medium text-primary">What should I do if the resources I need aren't available?</h3>
              <p className="text-sm text-muted-foreground">
                You can Contact, and Request Resources here <a href="https://wa.me/919676242565" className="text-primary hover:text-green-500 transition-colors duration-200">Link</a>
              </p>
            </div>
            <div className="space-y-2 p-3 rounded-md hover:bg-muted transition-all duration-200">
              <h3 className="font-medium text-primary">Can I contribute my own resources to PEC.UP?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, of course! Drop us a message—we'll review it and proceed. <a href="https://wa.me/919676242565" className="text-primary hover:text-green-500 transition-colors duration-200">Link</a>
              </p>
            </div>
            <div className="space-y-2 p-3 rounded-md hover:bg-muted transition-all duration-200">
              <h3 className="font-medium text-primary">Is this website built from scratch?</h3>
              <p className="text-sm text-muted-foreground">
                Not 100%. We used templates and AI tools to speed things up. But yeah, we learned a lot through this project!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <ChatBubble href="https://chat.pecup.in" />
    </div>
  );
}