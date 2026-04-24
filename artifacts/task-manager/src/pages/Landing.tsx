import { Link } from "wouter";
import { Navbar } from "../components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ListTodo, PieChart } from "lucide-react";

export default function Landing() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 lg:pt-36 lg:pb-40">
          <div className="absolute inset-0 bg-[url('/bg-pattern.svg')] opacity-5" />
          <div className="container relative mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="font-serif text-5xl font-medium tracking-tight text-foreground sm:text-6xl md:text-7xl">
                A calm space for your <span className="text-primary italic">busy day.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground md:text-xl leading-relaxed max-w-2xl mx-auto">
                Tasker is a beautifully simple list manager that helps you focus on what matters. 
                No clutter, no endless configuration—just your thoughts, organized.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/sign-up">
                  <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base shadow-md bg-primary hover:bg-primary/90 text-primary-foreground rounded-full">
                    Start organizing for free
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base rounded-full bg-background border-border hover:bg-secondary/50 text-foreground">
                    Log in to your account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-border/50 bg-secondary/20 py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-5xl">
              <div className="text-center mb-16">
                <h2 className="font-serif text-3xl font-medium text-foreground sm:text-4xl">
                  Everything you need. Nothing you don't.
                </h2>
              </div>
              
              <div className="grid gap-12 md:grid-cols-3">
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border shadow-sm">
                  <div className="mb-6 rounded-full bg-primary/10 p-4 text-primary">
                    <ListTodo className="h-8 w-8" />
                  </div>
                  <h3 className="font-serif text-xl font-medium text-foreground mb-3">Focused Lists</h3>
                  <p className="text-muted-foreground">
                    Keep your tasks organized by priority. Focus on high-impact items first, 
                    and save the rest for later.
                  </p>
                </div>
                
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border shadow-sm">
                  <div className="mb-6 rounded-full bg-accent/10 p-4 text-accent">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="font-serif text-xl font-medium text-foreground mb-3">Satisfying Flow</h3>
                  <p className="text-muted-foreground">
                    Experience the calm satisfaction of checking items off your list. 
                    A clean interface that stays out of your way.
                  </p>
                </div>
                
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border shadow-sm">
                  <div className="mb-6 rounded-full bg-chart-3/10 p-4 text-chart-3">
                    <PieChart className="h-8 w-8" />
                  </div>
                  <h3 className="font-serif text-xl font-medium text-foreground mb-3">Clear Insights</h3>
                  <p className="text-muted-foreground">
                    Your personal dashboard shows you exactly how you're doing. 
                    Track your completion rate and recent activity effortlessly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-3xl font-medium sm:text-4xl mb-6 text-white">
                Ready to find your focus?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-10">
                Join thousands of people who have simplified their day with Tasker.
              </p>
              <Link href="/sign-up">
                <Button size="lg" className="h-14 px-10 text-base shadow-lg bg-background text-primary hover:bg-background/90 rounded-full">
                  Create your free account
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="border-t border-border bg-background py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Tasker. A beautiful way to get things done.</p>
        </div>
      </footer>
    </div>
  );
}
