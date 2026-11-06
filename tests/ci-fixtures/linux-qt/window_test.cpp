#include <QtTest>
#include <QPushButton>
class WindowTest : public QObject {
  Q_OBJECT
private slots:
  void clickCounts() {
    QPushButton b("go"); int n = 0;
    QObject::connect(&b, &QPushButton::clicked, [&] { ++n; });
    b.show(); QTest::mouseClick(&b, Qt::LeftButton);
    QCOMPARE(n, 1);
  }
};
QTEST_MAIN(WindowTest)
#include "window_test.moc"
