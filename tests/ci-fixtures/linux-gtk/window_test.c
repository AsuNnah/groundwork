#include <gtk/gtk.h>
/* opens a real GTK window on the (Xvfb) display and checks its title */
int main(void) {
  if (!gtk_init_check()) { g_printerr("no display\n"); return 1; }
  GtkWidget *w = gtk_window_new();
  gtk_window_set_title(GTK_WINDOW(w), "fixture");
  gtk_window_present(GTK_WINDOW(w));
  for (int i = 0; i < 50; i++) g_main_context_iteration(NULL, FALSE);
  int ok = g_strcmp0(gtk_window_get_title(GTK_WINDOW(w)), "fixture") == 0 && gtk_widget_get_visible(w);
  gtk_window_destroy(GTK_WINDOW(w));
  return ok ? 0 : 1;
}
