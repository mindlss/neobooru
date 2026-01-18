import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import styles from './ToastContainer.module.scss'
import { Toast } from '../../app/lib/ToastProvider'

interface Props {
  toasts: Toast[]
  removeToast: (id: string) => void
  pauseToast: (id: string) => void
  resumeToast: (id: string) => void
}

const ToastContainer: React.FC<Props> = ({
  toasts,
  removeToast,
  pauseToast,
  resumeToast,
}) => {
  const [hoveredToast, setHoveredToast] = useState<string | null>(null)

  const handleRemove = (id: string) => {
    removeToast(id)
  }

  const handleMouseEnter = (id: string) => {
    setHoveredToast(id)
    pauseToast(id)
  }

  const handleMouseLeave = (id: string) => {
    setHoveredToast(null)
    resumeToast(id)
  }

  return (
    <div className={styles.toastContainer}>
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{
              y: 100,
              opacity: 0,
              scale: 0.8,
            }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: 0.85,
              transition: {
                duration: 0.2,
                ease: 'easeOut',
              },
            }}
            transition={{
              layout: {
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1],
              },
              y: {
                type: 'spring',
                stiffness: 350,
                damping: 30,
              },
              opacity: { duration: 0.3 },
              scale: { duration: 0.3 },
            }}
            className={`
              ${styles.toast} 
              ${styles[toast.type || 'info']}
            `}
            onClick={() => handleRemove(toast.id)}
            onMouseEnter={() => handleMouseEnter(toast.id)}
            onMouseLeave={() => handleMouseLeave(toast.id)}
          >
            <div className={styles.content}>
              <div className={styles.iconWrapper}>
                <span className={styles.icon}>
                  {toast.type === 'success' && '✓'}
                  {toast.type === 'error' && '✕'}
                  {toast.type === 'warning' && '!'}
                  {toast.type === 'info' && 'i'}
                </span>
              </div>
              <span className={styles.message}>{toast.message}</span>
            </div>

            <div className={styles.progressBar}>
              <div
                className={`${styles.progress} ${hoveredToast === toast.id ? styles.paused : ''}`}
                style={{ width: `${toast.progress ?? 0}%` }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastContainer
