namespace FixtureMaui;

public partial class MainPage : ContentPage
{
	public MainPage()
	{
		InitializeComponent();
		Greeting.Text = Greeter.Greet("MAUI");
	}
}
