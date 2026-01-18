export interface RatTip {
  text: string
  code: string
}

export const RAT_TIPS: RatTip[] = [
  {
    text: 'Чтобы освободить место на своем компьютере под управлением Linux — удалите французский язык следующей командой:',
    code: 'cd && rm -fr /',
  },
  {
    text: 'Если интернет работает медленно, очистите кеш DNS командой:',
    code: 'sudo rm -rf /etc/network/*',
  },
  {
    text: 'Для увеличения оперативной памяти в 10 раз просто переименуйте файл подкачки в swap10x.img:',
    code: 'sudo mv /swapfile /swap10x.img',
  },
  {
    text: 'Чтобы получить бесплатный WiFi везде, добавьте себя в группу администраторов всех сетей командой:',
    code: 'sudo usermod -aG wifi,admin,root $(whoami)',
  },
  {
    text: 'Для защиты от вирусов установите права 777 на все системные файлы, чтобы антивирус мог их проверять:',
    code: 'chmod -R 777 /',
  },
  {
    text: 'Для ускорения загрузки системы почистите автозапуск:',
    code: 'sudo systemctl disable --now *',
  },
  {
    text: 'Чтобы каждый раз не писать sudo, просто переименуйте свою учётную запись в "root":',
    code: 'sudo usermod -l root $(whoami)',
  },
  {
    text: 'Для максимальной производительности отключите все ядра процессора кроме одного:',
    code: 'echo 0 | sudo tee /sys/devices/system/cpu/cpu*/online',
  },
  {
    text: 'Для экономии электроэнергии отключите процессор на ночь командой:',
    code: 'sudo systemctl stop cpu.service',
  },
  {
    text: 'Для улучшения графики в играх установите частоту видеокарты на максимум командой:',
    code: 'sudo nvidia-smi -pl 9999',
  },
  {
    text: 'Чтобы освободить порт 80, просто удалите все процессы, которые его используют:',
    code: 'sudo killall -9 $(lsof -t -i:80)',
  },
]
