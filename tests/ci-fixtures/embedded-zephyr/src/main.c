#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>
#include "add.h"

int main(void)
{
	printk("fixture: 2 + 3 = %d\n", fixture_add(2, 3));
	return 0;
}
