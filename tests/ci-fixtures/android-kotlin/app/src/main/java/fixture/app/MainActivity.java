package fixture.app;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    public static String greet(String name) { return "hello " + name; }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        TextView t = new TextView(this);
        t.setText(greet("android"));
        setContentView(t);
    }
}
