import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import InfoIcon from 'shared/ui/img/info.svg?react'
import rat from 'shared/ui/img/rat.gif'
import styles from './notFound.module.scss'
import { useToast } from 'utils/useToast'
import { RAT_TIPS, RatTip } from 'shared/constants/ratTips'

export default function NotFoundPage() {
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [currentTip, setCurrentTip] = useState<RatTip>(RAT_TIPS[0])

  useEffect(() => {
    const randomTip = RAT_TIPS[Math.floor(Math.random() * RAT_TIPS.length)]
    setCurrentTip(randomTip)
  }, [])

  const handleRat = () => {
    const otherTips = RAT_TIPS.filter((tip) => tip.code !== currentTip.code)
    const newTip = otherTips[Math.floor(Math.random() * otherTips.length)]
    setCurrentTip(newTip)

    addToast({
      message: 'Совет от крысы изменён',
      type: 'info',
      duration: 2000,
    })
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className={styles.errorCode}>404</h1>
        <p className={styles.errorText}>Страница не найдена</p>

        <motion.img
          className={styles.rat}
          src={rat}
          alt="rat"
          onClick={handleRat}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        />

        <button className={styles.button} onClick={handleGoHome}>
          На главную
        </button>

        <motion.div
          className={styles.card}
          key={currentTip.code}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.cardHeader}>
            <InfoIcon className={styles.cardIcon} />
            <h3 className={styles.cardTitle}>Полезный совет</h3>
          </div>
          <p className={styles.cardText}>
            {currentTip.text}
            <br />
            <br />
            <code className={styles.code}>{currentTip.code}</code>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
