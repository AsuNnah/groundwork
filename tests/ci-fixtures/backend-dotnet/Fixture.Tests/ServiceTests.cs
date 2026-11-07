using System;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using Npgsql;
using Xunit;

// The backend CI template starts Postgres and Redis and passes their URLs in DATABASE_URL and REDIS_URL.
public class ServiceTests
{
    static Uri Url(string name) => new(Environment.GetEnvironmentVariable(name) ?? throw new InvalidOperationException($"{name} is not set"));

    [Fact]
    public async Task PostgresAnswers()
    {
        var u = Url("DATABASE_URL");
        var user = u.UserInfo.Split(':', 2);
        var settings = new NpgsqlConnectionStringBuilder   // Npgsql takes key=value settings, not a postgres:// URL
        {
            Host = u.Host,
            Port = u.Port,
            Username = Uri.UnescapeDataString(user[0]),
            Password = user.Length > 1 ? Uri.UnescapeDataString(user[1]) : null,
            Database = u.AbsolutePath.TrimStart('/'),
        };
        await using var db = new NpgsqlConnection(settings.ConnectionString);
        await db.OpenAsync();
        await using var cmd = new NpgsqlCommand("select 2 * 21", db);
        Assert.Equal(42, Convert.ToInt32(await cmd.ExecuteScalarAsync()));
    }

    [Fact]
    public async Task RedisAnswersPing()
    {
        var u = Url("REDIS_URL");
        using var tcp = new TcpClient();
        await tcp.ConnectAsync(u.Host, u.Port);
        var stream = tcp.GetStream();
        await stream.WriteAsync(Encoding.ASCII.GetBytes("PING\r\n"));
        var reply = new byte[64];
        var n = await stream.ReadAsync(reply);
        Assert.Contains("PONG", Encoding.ASCII.GetString(reply, 0, n));
    }
}
